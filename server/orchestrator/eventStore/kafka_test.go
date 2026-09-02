package eventstore

import (
	"errors"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

func TestNew_ReturnsInterface(t *testing.T) {
	store := New("localhost:9999", "test-group")
	if store == nil {
		t.Fatal("expected non-nil store")
	}
}

func TestConnect_FailsOnUnreachableBroker(t *testing.T) {
	store := New("localhost:19999", "test-group")
	err := store.Connect()
	if err == nil {
		t.Error("expected error connecting to unreachable broker, got nil")
	}
}

func TestClose_NoError(t *testing.T) {
	store := New("localhost:19999", "test-group")
	// Connect will fail; Close should still not panic
	_ = store.Connect()
	if err := store.Close(); err != nil {
		t.Errorf("unexpected error on Close: %v", err)
	}
}

func TestWriteMessage_RespectsTimeout(t *testing.T) {
	// This test verifies WriteMessage does not block indefinitely.
	// We test the timeout by checking the function returns within 3s
	// even when given a store with no real Kafka connection (nil writer
	// returns "not connected" immediately — which is also acceptable behavior).
	s := &store{writer: nil}
	start := time.Now()
	err := s.WriteMessage("test", "test-topic")
	elapsed := time.Since(start)

	if elapsed > 3*time.Second {
		t.Errorf("WriteMessage took %v, want < 3s", elapsed)
	}
	if err == nil {
		t.Error("WriteMessage with nil writer should return error")
	}
}

// TestConnect_ConfiguresWriterForAsyncDelivery guards against the
// lattice-hub#201 regression: a synchronous kafka.Writer's WriteMessages
// blocks for its BatchTimeout (1s default) on every call, which stalls the
// serial mesh frame loop that calls WriteMessage inline. The writer must be
// async with a short batch timeout so a delivery failure can still be
// recorded through Completion instead of the WriteMessage return value.
func TestConnect_ConfiguresWriterForAsyncDelivery(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{}}}
	s := newTestStore(t, listenLocal(t), fake)

	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	if !s.writer.Async {
		t.Error("writer.Async = false, want true so WriteMessage never blocks the mesh frame loop")
	}
	if s.writer.BatchTimeout <= 0 || s.writer.BatchTimeout > 50*time.Millisecond {
		t.Errorf("writer.BatchTimeout = %v, want a short positive timeout (<=50ms) so async batches still flush promptly", s.writer.BatchTimeout)
	}
	if s.writer.Completion == nil {
		t.Error("writer.Completion = nil, want a callback that records delivery failures through Stats()")
	}
}

// TestWriterCompletion_RecordsDeliveryFailuresInStats exercises the
// Completion callback directly, the way the async kafka.Writer invokes it
// once a batch's delivery outcome is known, and checks the failure reaches
// Stats() for the right topic and in the totals.
func TestWriterCompletion_RecordsDeliveryFailuresInStats(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{}}}
	s := newTestStore(t, listenLocal(t), fake)

	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })
	if s.writer.Completion == nil {
		t.Fatal("writer.Completion = nil, cannot exercise the delivery-failure path")
	}

	boom := errors.New("broker unavailable")
	s.writer.Completion([]kafka.Message{{Topic: TopicMotionTrigger}}, boom)

	st := s.Stats()
	if st.FailedWrites != 1 {
		t.Errorf("FailedWrites = %d, want 1", st.FailedWrites)
	}
	if got := st.Topics[TopicMotionTrigger].FailedWrites; got != 1 {
		t.Errorf("motion-trigger FailedWrites = %d, want 1", got)
	}
	if st.Topics[TopicMotionTrigger].LastError != boom.Error() {
		t.Errorf("motion-trigger LastError = %q, want %q", st.Topics[TopicMotionTrigger].LastError, boom.Error())
	}
	if got := st.Topics[TopicMeshMessages].FailedWrites; got != 0 {
		t.Errorf("mesh-messages FailedWrites = %d, want 0 (completion was for motion-trigger only)", got)
	}
}

// TestWriterCompletion_NoErrorLeavesStatsClean checks a successful
// Completion call (err == nil, as kafka-go invokes it for a delivered batch)
// records nothing.
func TestWriterCompletion_NoErrorLeavesStatsClean(t *testing.T) {
	fake := &fakeTopicCreator{responses: []fakeCreateResponse{{}}}
	s := newTestStore(t, listenLocal(t), fake)

	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	s.writer.Completion([]kafka.Message{{Topic: TopicMotionTrigger}}, nil)

	st := s.Stats()
	if st.FailedWrites != 0 {
		t.Errorf("FailedWrites = %d, want 0 after a successful completion", st.FailedWrites)
	}
}
