package eventstore

// EventStoreInterface defines the event storage contract.
type EventStoreInterface interface {
	Connect() error
	WriteMessage(event string, topic string) error
	SubscribeToEvents(topic string) error
	Close() error
}
