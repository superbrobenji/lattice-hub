package eventstore

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"sync"
	"time"

	"github.com/segmentio/kafka-go"
)

type store struct {
	broker  string
	groupId string
	writer  *kafka.Writer
	reader  *kafka.Reader

	// Topic bootstrap. The producer topics are created explicitly at Connect
	// time; see ensure.go for why auto-create cannot be relied on.
	admin                topicCreator
	topics               []string
	ensureTimeout        time.Duration // per CreateTopics attempt
	ensureInitialBackoff time.Duration
	ensureMaxBackoff     time.Duration
	ensureCancel         context.CancelFunc
	ensureDone           chan struct{}

	mu    sync.Mutex // guards stats
	stats Stats
}

func New(broker string, groupId string) EventStoreInterface {
	return &store{
		broker:               broker,
		groupId:              groupId,
		topics:               Topics(),
		ensureTimeout:        10 * time.Second,
		ensureInitialBackoff: time.Second,
		ensureMaxBackoff:     30 * time.Second,
		stats:                DisconnectedStats(),
	}
}

func (s *store) Connect() error {
	slog.Info("Connecting to Kafka", "broker", s.broker)

	conn, err := net.DialTimeout("tcp", s.broker, 5*time.Second)
	if err != nil {
		return fmt.Errorf("kafka broker unreachable at %s: %w", s.broker, err)
	}
	_ = conn.Close()

	s.stopEnsure()
	s.writer = &kafka.Writer{
		Addr:     kafka.TCP(s.broker),
		Balancer: &kafka.LeastBytes{},
		// Async delivery keeps WriteMessage from ever blocking the caller —
		// notably the serial mesh frame loop, which calls it inline for every
		// frame. A synchronous writer's WriteMessages blocks for the whole
		// BatchTimeout (1s by default) on each call; see lattice-hub#201's
		// regression. BatchTimeout is set short so async batches still flush
		// promptly instead of waiting on the (now-moot) 1s default.
		Async:        true,
		BatchTimeout: 10 * time.Millisecond,
		// Completion reports the outcome of an async batch once it's known.
		// This is now the only path that records delivery failures — the
		// WriteMessage return value no longer carries them — so Stats() (and
		// GET /api/v1/status's kafka object) stays truthful.
		Completion: func(messages []kafka.Message, err error) {
			if err == nil {
				return
			}
			for _, msg := range messages {
				s.recordWriteFailure(msg.Topic, err)
			}
		},
	}
	if s.admin == nil {
		// Shares kafka.DefaultTransport with the writer, so a successful
		// CreateTopics also refreshes the writer's cached metadata.
		s.admin = &kafka.Client{Addr: kafka.TCP(s.broker), Timeout: s.ensureTimeout}
	}
	s.setConnected(true)
	slog.Info("Connected to Kafka", "broker", s.broker)

	// The first attempt is synchronous so that, in the normal case, every
	// topic exists before the mesh server publishes its first event. If the
	// broker is reachable but cannot create topics yet, keep trying in the
	// background — Connect never fails over topic creation.
	ctx, cancel := context.WithCancel(context.Background())
	s.ensureCancel = cancel
	s.ensureDone = make(chan struct{})
	if err := s.ensureTopicsOnce(ctx); err != nil {
		slog.Warn("Kafka topics not ready — retrying in background", "error", err, "retryIn", s.ensureInitialBackoff)
		go func() {
			defer close(s.ensureDone)
			if sleepCtx(ctx, s.ensureInitialBackoff) {
				s.ensureTopicsLoop(ctx)
			}
		}()
	} else {
		close(s.ensureDone)
		slog.Info("Kafka topics ready", "topics", s.topics)
	}
	return nil
}

// WriteMessage hands event to the writer for topic and returns without
// waiting for the broker to acknowledge it — the writer is configured for
// asynchronous delivery (see Connect), so this never blocks the mesh frame
// loop the way a synchronous kafka.Writer's WriteMessages would.
//
// It returns an error only when the store has never connected. Once
// connected, it returns nil as soon as the message is handed to the writer;
// delivery failures are recorded asynchronously via the writer's Completion
// callback and surface later through Stats(), not through this return
// value. The rare synchronous error WriteMessages can still return in async
// mode (e.g. the message could not be enqueued) is recorded the same way,
// through recordWriteFailure, so Stats() stays truthful either way.
func (s *store) WriteMessage(event string, topic string) error {
	if s.writer == nil {
		err := errors.New("not connected")
		s.recordWriteFailure(topic, err)
		return err
	}
	slog.Debug("Delivering message", "topic", topic)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := s.writer.WriteMessages(ctx,
		kafka.Message{Topic: topic, Value: []byte(event)},
	); err != nil {
		slog.Error("Kafka enqueue failed", "topic", topic, "error", err)
		s.recordWriteFailure(topic, err)
	}
	return nil
}

func (s *store) Close() error {
	s.stopEnsure()
	s.setConnected(false)
	if s.reader != nil {
		if err := s.reader.Close(); err != nil {
			return fmt.Errorf("closing reader: %w", err)
		}
	}
	if s.writer != nil {
		if err := s.writer.Close(); err != nil {
			return fmt.Errorf("closing writer: %w", err)
		}
	}
	return nil
}

// Stats returns a copy of the current health snapshot.
func (s *store) Stats() Stats {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := s.stats
	out.Topics = make(map[string]TopicStats, len(s.stats.Topics))
	for name, ts := range s.stats.Topics {
		if ts.LastFailureAt != nil {
			at := *ts.LastFailureAt
			ts.LastFailureAt = &at
		}
		out.Topics[name] = ts
	}
	if s.stats.LastFailureAt != nil {
		at := *s.stats.LastFailureAt
		out.LastFailureAt = &at
	}
	return out
}

// ensureTopicsLoop retries topic creation with exponential backoff until every
// topic exists or ctx is cancelled.
func (s *store) ensureTopicsLoop(ctx context.Context) {
	backoff := s.ensureInitialBackoff
	for {
		err := s.ensureTopicsOnce(ctx)
		if err == nil {
			slog.Info("Kafka topics ready", "topics", s.topics)
			return
		}
		if ctx.Err() != nil {
			return
		}
		slog.Warn("Failed to create Kafka topics — will retry", "error", err, "retryIn", backoff)
		if !sleepCtx(ctx, backoff) {
			return
		}
		backoff = min(backoff*2, s.ensureMaxBackoff)
	}
}

// ensureTopicsOnce runs one CreateTopics round trip and records the outcome.
// It returns nil once every producer topic exists.
func (s *store) ensureTopicsOnce(ctx context.Context) error {
	attemptCtx, cancel := context.WithTimeout(ctx, s.ensureTimeout)
	defer cancel()
	failed, err := ensureTopics(attemptCtx, s.admin, s.topics)
	now := time.Now()

	s.mu.Lock()
	defer s.mu.Unlock()
	if err != nil {
		s.stats.TopicsReady = false
		s.stats.LastError = err.Error()
		s.stats.LastFailureAt = &now
		return err
	}
	for _, name := range s.topics {
		ts := s.topicStatsLocked(name)
		if terr, bad := failed[name]; bad {
			ts.Ready = false
			ts.LastError = terr.Error()
			ts.LastFailureAt = &now
		} else {
			ts.Ready = true
		}
		s.stats.Topics[name] = ts
	}
	s.stats.TopicsReady = len(failed) == 0
	if len(failed) > 0 {
		err := joinTopicErrors(s.topics, failed)
		s.stats.LastError = err.Error()
		s.stats.LastFailureAt = &now
		return err
	}
	return nil
}

// stopEnsure cancels a running topic-creation loop and waits for it to exit.
func (s *store) stopEnsure() {
	if s.ensureCancel == nil {
		return
	}
	s.ensureCancel()
	<-s.ensureDone
	s.ensureCancel = nil
	s.ensureDone = nil
}

func (s *store) setConnected(connected bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stats.Connected = connected
}

func (s *store) recordWriteFailure(topic string, err error) {
	now := time.Now()
	s.mu.Lock()
	defer s.mu.Unlock()
	ts := s.topicStatsLocked(topic)
	ts.FailedWrites++
	ts.LastError = err.Error()
	ts.LastFailureAt = &now
	s.stats.Topics[topic] = ts
	s.stats.FailedWrites++
	s.stats.LastError = err.Error()
	s.stats.LastFailureAt = &now
}

// topicStatsLocked returns the entry for topic, creating the map on first use
// so zero-value stores stay usable. Caller holds s.mu.
func (s *store) topicStatsLocked(topic string) TopicStats {
	if s.stats.Topics == nil {
		s.stats.Topics = make(map[string]TopicStats)
	}
	return s.stats.Topics[topic]
}

// sleepCtx waits for d or until ctx is done, reporting whether the full wait
// elapsed.
func sleepCtx(ctx context.Context, d time.Duration) bool {
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return true
	case <-ctx.Done():
		return false
	}
}
