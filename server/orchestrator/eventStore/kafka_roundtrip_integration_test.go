package eventstore

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

// lastOffset returns the high-water mark of motion-trigger partition 0, the
// same probe the sidecar's /sidecar/kafka/events/recent handler uses.
func lastOffset(t *testing.T, broker string) int64 {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	conn, err := kafka.DialLeader(ctx, "tcp", broker, TopicMotionTrigger, 0)
	if err != nil {
		t.Fatalf("DialLeader: %v", err)
	}
	defer func() { _ = conn.Close() }()
	off, err := conn.ReadLastOffset()
	if err != nil {
		t.Fatalf("ReadLastOffset: %v", err)
	}
	return off
}

// TestIntegration_WriteMessageLandsOnBroker guards the async-writer change:
// a single WriteMessage must become visible on the broker promptly, the way
// the e2e "motion event lands in the Kafka events page" test observes it.
func TestIntegration_WriteMessageLandsOnBroker(t *testing.T) {
	broker := os.Getenv("KAFKA_TEST_BROKER")
	if broker == "" {
		t.Skip("set KAFKA_TEST_BROKER=host:port to run against a live broker")
	}
	s := New(broker, "roundtrip-test")
	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	before := lastOffset(t, broker)
	start := time.Now()
	if err := s.WriteMessage(`{"type":"motion","mac":"aa:bb:cc:dd:ee:01"}`, TopicMotionTrigger); err != nil {
		t.Fatalf("WriteMessage: %v", err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if lastOffset(t, broker) > before {
			t.Logf("message visible after %v (stats: %+v)", time.Since(start), s.Stats())
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	t.Fatalf("message never became visible within 10s: offset still %d; stats: %+v", before, s.Stats())
}
