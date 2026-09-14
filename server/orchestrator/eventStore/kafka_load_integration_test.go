package eventstore

import (
	"fmt"
	"os"
	"testing"
	"time"
)

// TestIntegration_MotionSurvivesConcurrentAuditWrites mimics the e2e stack:
// a steady stream of mesh-messages audit writes (every frame) with one
// motion-trigger write in the middle. The motion event must become readable
// on the broker even while other topics are being written concurrently.
func TestIntegration_MotionSurvivesConcurrentAuditWrites(t *testing.T) {
	broker := os.Getenv("KAFKA_TEST_BROKER")
	if broker == "" {
		t.Skip("set KAFKA_TEST_BROKER=host:port to run against a live broker")
	}
	s := New(broker, "load-test")
	if err := s.Connect(); err != nil {
		t.Fatalf("Connect: %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	before := lastOffset(t, broker)
	stop := make(chan struct{})
	go func() {
		i := 0
		for {
			select {
			case <-stop:
				return
			default:
			}
			_ = s.WriteMessage(fmt.Sprintf(`{"direction":"incoming","n":%d}`, i), TopicMeshMessages)
			_ = s.WriteMessage(fmt.Sprintf(`{"direction":"outgoing","n":%d}`, i), TopicMeshMessages)
			i++
			time.Sleep(50 * time.Millisecond)
		}
	}()
	time.Sleep(300 * time.Millisecond)
	start := time.Now()
	if err := s.WriteMessage(`{"type":"pir_motion","mac":"aa:bb:cc:dd:ee:01"}`, TopicMotionTrigger); err != nil {
		t.Fatalf("WriteMessage: %v", err)
	}
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if lastOffset(t, broker) > before {
			close(stop)
			t.Logf("motion visible after %v; stats: %+v", time.Since(start), s.Stats())
			return
		}
		time.Sleep(100 * time.Millisecond)
	}
	close(stop)
	t.Fatalf("motion never visible within 10s; stats: %+v", s.Stats())
}
