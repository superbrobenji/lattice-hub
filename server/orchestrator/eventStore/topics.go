package eventstore

// Kafka topics the orchestrator produces to. Every producer topic name lives
// here so the startup ensure step (see ensure.go) and the writers in the mesh
// package can never drift apart.
const (
	// TopicMotionTrigger carries PIR motion events.
	TopicMotionTrigger = "motion-trigger"
	// TopicMeshEnrollment carries enrollment requests from unenrolled nodes.
	TopicMeshEnrollment = "mesh-enrollment"
	// TopicMeshMessages carries the inbound/outbound mesh frame audit log,
	// including health and route reports.
	TopicMeshMessages = "mesh-messages"
)

// Topics returns every producer topic, in a stable order.
func Topics() []string {
	return []string{TopicMotionTrigger, TopicMeshEnrollment, TopicMeshMessages}
}
