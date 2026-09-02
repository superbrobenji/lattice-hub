package eventstore

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/segmentio/kafka-go"
)

// topicCreator is the subset of *kafka.Client used to create topics; tests
// substitute a fake broker.
type topicCreator interface {
	CreateTopics(ctx context.Context, req *kafka.CreateTopicsRequest) (*kafka.CreateTopicsResponse, error)
}

// ensureTopics asks the broker to create every topic in topics with one
// partition and a replication factor of one, which matches the single-broker
// deployment and keeps the sidecar's partition-0 reader complete. Topics that
// already exist are reported as ready.
//
// The returned map lists the topics the broker refused, keyed by name; an
// empty map means every topic exists. A non-nil error means the request
// itself failed and nothing is known about any topic.
//
// Explicit creation is required because kafka-go's Writer sends its metadata
// requests with allow_auto_topic_creation=false, so the broker's
// auto.create.topics.enable never applies to the orchestrator's writes
// (lattice-hub#192).
func ensureTopics(ctx context.Context, admin topicCreator, topics []string) (map[string]error, error) {
	configs := make([]kafka.TopicConfig, len(topics))
	for i, name := range topics {
		configs[i] = kafka.TopicConfig{Topic: name, NumPartitions: 1, ReplicationFactor: 1}
	}

	res, err := admin.CreateTopics(ctx, &kafka.CreateTopicsRequest{Topics: configs})
	if err != nil {
		return nil, err
	}

	failed := make(map[string]error)
	for _, name := range topics {
		if terr := res.Errors[name]; terr != nil && !errors.Is(terr, kafka.TopicAlreadyExists) {
			failed[name] = terr
		}
	}
	return failed, nil
}

// joinTopicErrors renders per-topic failures in topic order.
func joinTopicErrors(topics []string, failed map[string]error) error {
	parts := make([]string, 0, len(failed))
	for _, name := range topics {
		if err, ok := failed[name]; ok {
			parts = append(parts, fmt.Sprintf("%s: %v", name, err))
		}
	}
	return fmt.Errorf("create topics: %s", strings.Join(parts, "; "))
}
