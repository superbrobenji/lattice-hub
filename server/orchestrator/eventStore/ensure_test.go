package eventstore

import (
	"context"
	"errors"
	"net"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

// fakeCreateResponse scripts one CreateTopics round trip.
type fakeCreateResponse struct {
	errs map[string]error // per-topic errors; missing entry = created
	err  error            // request-level failure (no per-topic results)
}

// fakeTopicCreator stands in for *kafka.Client. Each call pops the next
// scripted response; once the script is exhausted the last one repeats.
type fakeTopicCreator struct {
	mu        sync.Mutex
	requests  []*kafka.CreateTopicsRequest
	responses []fakeCreateResponse
}

func (f *fakeTopicCreator) CreateTopics(_ context.Context, req *kafka.CreateTopicsRequest) (*kafka.CreateTopicsResponse, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.requests = append(f.requests, req)
	idx := len(f.requests) - 1
	if idx >= len(f.responses) {
		idx = len(f.responses) - 1
	}
	r := f.responses[idx]
	if r.err != nil {
		return nil, r.err
	}
	errs := make(map[string]error, len(req.Topics))
	for _, t := range req.Topics {
		errs[t.Topic] = r.errs[t.Topic]
	}
	return &kafka.CreateTopicsResponse{Errors: errs}, nil
}

func (f *fakeTopicCreator) calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.requests)
}

func TestTopics_ListsEveryProducerTopic(t *testing.T) {
	got := Topics()
	want := []string{"motion-trigger", "mesh-enrollment", "mesh-messages"}
	if len(got) != len(want) {
		t.Fatalf("Topics() = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("Topics()[%d] = %q, want %q", i, got[i], want[i])
		}
	}
}

func TestEnsureTopics_RequestsEveryTopicWithSinglePartition(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{}}}

	failed, err := ensureTopics(context.Background(), fake, []string{"a", "b"})
	if err != nil {
		t.Fatalf("ensureTopics: %v", err)
	}
	if len(failed) != 0 {
		t.Errorf("failed = %v, want none", failed)
	}
	if fake.calls() != 1 {
		t.Fatalf("CreateTopics called %d times, want 1", fake.calls())
	}
	req := fake.requests[0]
	if len(req.Topics) != 2 {
		t.Fatalf("request carried %d topics, want 2", len(req.Topics))
	}
	for i, want := range []string{"a", "b"} {
		tc := req.Topics[i]
		if tc.Topic != want || tc.NumPartitions != 1 || tc.ReplicationFactor != 1 {
			t.Errorf("topic[%d] = %+v, want {Topic:%q NumPartitions:1 ReplicationFactor:1}", i, tc, want)
		}
	}
}

func TestEnsureTopics_TreatsAlreadyExistsAsReady(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{
		{errs: map[string]error{"a": kafka.TopicAlreadyExists}},
	}}

	failed, err := ensureTopics(context.Background(), fake, []string{"a"})
	if err != nil {
		t.Fatalf("ensureTopics: %v", err)
	}
	if len(failed) != 0 {
		t.Errorf("failed = %v, want none (already-existing topic is ready)", failed)
	}
}

func TestEnsureTopics_ReportsPerTopicFailures(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{
		{errs: map[string]error{"b": kafka.InvalidReplicationFactor}},
	}}

	failed, err := ensureTopics(context.Background(), fake, []string{"a", "b"})
	if err != nil {
		t.Fatalf("ensureTopics returned request error %v, want per-topic result", err)
	}
	if _, ok := failed["a"]; ok {
		t.Errorf("topic a reported as failed: %v", failed["a"])
	}
	if !errors.Is(failed["b"], kafka.InvalidReplicationFactor) {
		t.Errorf("failed[b] = %v, want InvalidReplicationFactor", failed["b"])
	}
}

func TestEnsureTopics_ReturnsRequestError(t *testing.T) {
	boom := errors.New("broker down")
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{err: boom}}}

	_, err := ensureTopics(context.Background(), fake, []string{"a"})
	if !errors.Is(err, boom) {
		t.Errorf("err = %v, want %v", err, boom)
	}
}

// newTestStore returns a store wired to a fake admin client with backoff
// short enough for tests.
func newTestStore(t *testing.T, broker string, fake *fakeTopicCreator) *store {
	t.Helper()
	s := New(broker, "test-group").(*store)
	s.admin = fake
	s.ensureInitialBackoff = time.Millisecond
	s.ensureMaxBackoff = 5 * time.Millisecond
	return s
}

func TestEnsureTopicsLoop_RetriesUntilBrokerAccepts(t *testing.T) {
	boom := errors.New("controller not ready")
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{err: boom}, {err: boom}, {}}}
	s := newTestStore(t, "127.0.0.1:1", fake)

	s.ensureTopicsLoop(context.Background())

	if fake.calls() != 3 {
		t.Errorf("CreateTopics called %d times, want 3", fake.calls())
	}
	st := s.Stats()
	if !st.TopicsReady {
		t.Errorf("TopicsReady = false after successful retry; stats %+v", st)
	}
	for _, name := range Topics() {
		if !st.Topics[name].Ready {
			t.Errorf("topic %s not ready after successful retry", name)
		}
	}
}

func TestEnsureTopicsLoop_PartialFailureRetriesUntilAllReady(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{
		{errs: map[string]error{TopicMeshMessages: kafka.InvalidReplicationFactor}},
		{},
	}}
	s := newTestStore(t, "127.0.0.1:1", fake)

	s.ensureTopicsLoop(context.Background())

	if fake.calls() != 2 {
		t.Errorf("CreateTopics called %d times, want 2", fake.calls())
	}
	st := s.Stats()
	if !st.TopicsReady {
		t.Errorf("TopicsReady = false, want true once every topic exists")
	}
	if !strings.Contains(st.Topics[TopicMeshMessages].LastError, "Replication Factor") {
		t.Errorf("mesh-messages lastError = %q, want the create failure recorded", st.Topics[TopicMeshMessages].LastError)
	}
}

func TestEnsureTopicsLoop_StopsWhenContextCancelled(t *testing.T) {
	boom := errors.New("controller not ready")
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{err: boom}}}
	s := newTestStore(t, "127.0.0.1:1", fake)

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
	defer cancel()
	done := make(chan struct{})
	go func() {
		s.ensureTopicsLoop(ctx)
		close(done)
	}()
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("ensureTopicsLoop did not return after context cancellation")
	}

	if fake.calls() < 1 {
		t.Error("CreateTopics never attempted")
	}
	st := s.Stats()
	if st.TopicsReady {
		t.Error("TopicsReady = true although every attempt failed")
	}
	if !strings.Contains(st.LastError, "controller not ready") {
		t.Errorf("LastError = %q, want the ensure failure", st.LastError)
	}
	if st.LastFailureAt == nil {
		t.Error("LastFailureAt = nil, want timestamp of the failed attempt")
	}
}

// listenLocal opens a throwaway TCP listener so Connect's reachability probe
// succeeds without a real broker.
func listenLocal(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			_ = c.Close()
		}
	}()
	return ln.Addr().String()
}

func TestConnect_EnsuresTopicsBeforeReturning(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{}}}
	s := newTestStore(t, listenLocal(t), fake)

	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	if fake.calls() != 1 {
		t.Errorf("CreateTopics called %d times during Connect, want 1", fake.calls())
	}
	st := s.Stats()
	if !st.Connected {
		t.Error("Connected = false after successful Connect")
	}
	if !st.TopicsReady {
		t.Error("TopicsReady = false immediately after Connect, want topics created synchronously")
	}
}

func TestConnect_KeepsRetryingInBackgroundWhenEnsureFails(t *testing.T) {
	boom := errors.New("controller not ready")
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{err: boom}, {}}}
	s := newTestStore(t, listenLocal(t), fake)

	if err := s.Connect(); err != nil {
		t.Fatalf("Connect must not fail because topics could not be created yet: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	deadline := time.Now().Add(2 * time.Second)
	for !s.Stats().TopicsReady {
		if time.Now().After(deadline) {
			t.Fatalf("topics never became ready; CreateTopics calls=%d stats=%+v", fake.calls(), s.Stats())
		}
		time.Sleep(time.Millisecond)
	}
	if fake.calls() < 2 {
		t.Errorf("CreateTopics called %d times, want the background retry", fake.calls())
	}
}

func TestClose_StopsTopicRetryLoop(t *testing.T) {
	boom := errors.New("controller not ready")
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{err: boom}}}
	s := newTestStore(t, listenLocal(t), fake)

	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	if err := s.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}

	n := fake.calls()
	time.Sleep(20 * time.Millisecond)
	if fake.calls() != n {
		t.Errorf("CreateTopics still being called after Close (%d -> %d)", n, fake.calls())
	}
	if s.Stats().Connected {
		t.Error("Connected = true after Close")
	}
}
