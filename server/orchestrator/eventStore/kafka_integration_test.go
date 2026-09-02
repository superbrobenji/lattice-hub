package eventstore

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
)

// TestIntegration_ConnectCreatesProducerTopics runs against a live broker
// named by KAFKA_TEST_BROKER (host:port) and is skipped otherwise. It is the
// end-to-end check for lattice-hub#192: after Connect every producer topic
// exists on the broker and writes to each of them succeed.
func TestIntegration_ConnectCreatesProducerTopics(t *testing.T) {
	broker := os.Getenv("KAFKA_TEST_BROKER")
	if broker == "" {
		t.Skip("set KAFKA_TEST_BROKER=host:port to run against a live broker")
	}

	s := New(broker, "integration-test")
	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	if st := s.Stats(); !st.TopicsReady {
		t.Fatalf("topics not ready after Connect: %+v", st)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	client := &kafka.Client{Addr: kafka.TCP(broker), Timeout: 5 * time.Second}
	res, err := client.Metadata(ctx, &kafka.MetadataRequest{Topics: Topics()})
	if err != nil {
		t.Fatalf("metadata: %v", err)
	}
	found := map[string]bool{}
	for _, tp := range res.Topics {
		if tp.Error != nil {
			t.Errorf("broker reports topic %s: %v", tp.Name, tp.Error)
			continue
		}
		found[tp.Name] = true
	}
	for _, name := range Topics() {
		if !found[name] {
			t.Errorf("topic %s does not exist on broker %s", name, broker)
		}
	}

	for _, topic := range Topics() {
		if err := s.WriteMessage(`{"type":"integration-test"}`, topic); err != nil {
			t.Errorf("WriteMessage(%s): %v", topic, err)
		}
	}
	if st := s.Stats(); st.FailedWrites != 0 {
		t.Errorf("FailedWrites = %d after writes to freshly created topics: %+v", st.FailedWrites, st)
	}
}
