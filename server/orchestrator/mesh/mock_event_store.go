package mesh

import (
	"time"

	EventStore "github.com/superbrobenji/lattice-hub/eventStore"
)

// MockEventStore provides a mock implementation for testing.
type MockEventStore struct {
	messages []string
	topics   []string

	// WriteErr, when set, makes every WriteMessage fail with it.
	WriteErr error

	failedWrites  map[string]uint64
	lastError     string
	lastFailureAt *time.Time
}

func NewMockEventStore() *MockEventStore {
	return &MockEventStore{
		messages:     make([]string, 0),
		topics:       make([]string, 0),
		failedWrites: make(map[string]uint64),
	}
}

func (m *MockEventStore) Connect() error { return nil }
func (m *MockEventStore) Close() error   { return nil }

func (m *MockEventStore) WriteMessage(event string, topic string) error {
	if m.WriteErr != nil {
		now := time.Now()
		m.failedWrites[topic]++
		m.lastError = m.WriteErr.Error()
		m.lastFailureAt = &now
		return m.WriteErr
	}
	m.messages = append(m.messages, event)
	m.topics = append(m.topics, topic)
	return nil
}

// Stats reports a connected store with every topic ready plus any failures
// injected through WriteErr.
func (m *MockEventStore) Stats() EventStore.Stats {
	st := EventStore.DisconnectedStats()
	st.Connected = true
	st.TopicsReady = true
	for name, ts := range st.Topics {
		ts.Ready = true
		st.Topics[name] = ts
	}
	for topic, n := range m.failedWrites {
		ts := st.Topics[topic]
		ts.FailedWrites = n
		ts.LastError = m.lastError
		ts.LastFailureAt = m.lastFailureAt
		st.Topics[topic] = ts
		st.FailedWrites += n
	}
	st.LastError = m.lastError
	st.LastFailureAt = m.lastFailureAt
	return st
}

func (m *MockEventStore) GetMessages() []string { return m.messages }
func (m *MockEventStore) GetTopics() []string   { return m.topics }

var _ EventStore.EventStoreInterface = (*MockEventStore)(nil)
