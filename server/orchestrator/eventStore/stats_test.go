package eventstore

import (
	"testing"
)

func TestStats_BeforeConnect_ListsEveryTopicNotReady(t *testing.T) {
	s := New("127.0.0.1:1", "test-group")

	st := s.Stats()

	if st.Connected {
		t.Error("Connected = true before Connect")
	}
	if st.TopicsReady {
		t.Error("TopicsReady = true before Connect")
	}
	if st.FailedWrites != 0 || st.LastError != "" || st.LastFailureAt != nil {
		t.Errorf("unexpected failure state before any write: %+v", st)
	}
	if len(st.Topics) != len(Topics()) {
		t.Fatalf("Topics has %d entries, want %d", len(st.Topics), len(Topics()))
	}
	for _, name := range Topics() {
		ts, ok := st.Topics[name]
		if !ok {
			t.Errorf("topic %s missing from stats", name)
			continue
		}
		if ts.Ready || ts.FailedWrites != 0 || ts.LastError != "" || ts.LastFailureAt != nil {
			t.Errorf("topic %s = %+v, want zero state", name, ts)
		}
	}
}

func TestWriteMessage_CountsDeliveryFailuresPerTopic(t *testing.T) {
	s := New("127.0.0.1:1", "test-group") // never connected: every write fails

	_ = s.WriteMessage("x", TopicMeshMessages)
	_ = s.WriteMessage("x", TopicMeshMessages)
	_ = s.WriteMessage("x", TopicMotionTrigger)

	st := s.Stats()
	if st.FailedWrites != 3 {
		t.Errorf("FailedWrites = %d, want 3", st.FailedWrites)
	}
	if got := st.Topics[TopicMeshMessages].FailedWrites; got != 2 {
		t.Errorf("mesh-messages FailedWrites = %d, want 2", got)
	}
	if got := st.Topics[TopicMotionTrigger].FailedWrites; got != 1 {
		t.Errorf("motion-trigger FailedWrites = %d, want 1", got)
	}
	if got := st.Topics[TopicMeshEnrollment].FailedWrites; got != 0 {
		t.Errorf("mesh-enrollment FailedWrites = %d, want 0", got)
	}
	if st.LastError == "" || st.Topics[TopicMeshMessages].LastError == "" {
		t.Errorf("LastError not recorded: %+v", st)
	}
	if st.LastFailureAt == nil || st.Topics[TopicMeshMessages].LastFailureAt == nil {
		t.Errorf("LastFailureAt not recorded: %+v", st)
	}
	if st.Topics[TopicMeshEnrollment].LastFailureAt != nil {
		t.Error("mesh-enrollment LastFailureAt set although it never failed")
	}
}

func TestStats_ReturnsSnapshot(t *testing.T) {
	s := New("127.0.0.1:1", "test-group")

	st := s.Stats()
	st.Topics[TopicMotionTrigger] = TopicStats{Ready: true}

	if s.Stats().Topics[TopicMotionTrigger].Ready {
		t.Error("mutating the returned snapshot changed the store's state")
	}
}
