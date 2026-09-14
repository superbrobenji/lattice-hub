package eventstore

import "time"

// EventStoreInterface defines the event storage contract.
type EventStoreInterface interface {
	Connect() error
	WriteMessage(event string, topic string) error
	Close() error
	// Stats reports broker connectivity, topic readiness and delivery
	// failures; it backs the `kafka` object of GET /api/v1/status.
	Stats() Stats
}

// TopicStats describes one producer topic.
type TopicStats struct {
	// Ready is true once the topic is known to exist on the broker.
	Ready bool `json:"ready"`
	// FailedWrites counts deliveries to this topic that the writer's
	// asynchronous Completion callback reported as failed. WriteMessage
	// itself returns immediately without waiting for delivery, so a failure
	// is only counted once Kafka's response is known — moments after the
	// WriteMessage call, not synchronously with it.
	FailedWrites uint64 `json:"failedWrites"`
	// LastError is the most recent delivery or creation error, "" if none.
	LastError string `json:"lastError"`
	// LastFailureAt is when LastError was recorded; nil if never.
	LastFailureAt *time.Time `json:"lastFailureAt"`
}

// Stats is a point-in-time snapshot of the event store's health.
type Stats struct {
	// Connected is true once Connect succeeded and Close has not been called.
	Connected bool `json:"connected"`
	// TopicsReady is true once every producer topic exists on the broker.
	TopicsReady bool `json:"topicsReady"`
	// Topics holds per-topic state, keyed by topic name.
	Topics map[string]TopicStats `json:"topics"`
	// FailedWrites is the total number of failed deliveries across topics,
	// counted asynchronously as each one's outcome arrives (see
	// TopicStats.FailedWrites).
	FailedWrites uint64 `json:"failedWrites"`
	// LastError is the most recent error of any kind, "" if none.
	LastError string `json:"lastError"`
	// LastFailureAt is when LastError was recorded; nil if never.
	LastFailureAt *time.Time `json:"lastFailureAt"`
}

// DisconnectedStats returns the snapshot reported when no broker connection
// exists: every producer topic listed, none ready, nothing failed yet.
func DisconnectedStats() Stats {
	topics := make(map[string]TopicStats, len(Topics()))
	for _, name := range Topics() {
		topics[name] = TopicStats{}
	}
	return Stats{Topics: topics}
}
