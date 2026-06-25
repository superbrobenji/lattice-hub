package eventstore

import (
	"context"
	"fmt"
	"net"
	"time"

	"github.com/segmentio/kafka-go"
)

type store struct {
	broker  string
	groupId string
	writer  *kafka.Writer
	reader  *kafka.Reader
}

func New(broker string, groupId string) EventStoreInterface {
	return &store{broker: broker, groupId: groupId}
}

func (s *store) Connect() error {
	fmt.Printf("connecting to Kafka: %v\n", s.broker)

	conn, err := net.DialTimeout("tcp", s.broker, 5*time.Second)
	if err != nil {
		return fmt.Errorf("kafka broker unreachable at %s: %w", s.broker, err)
	}
	_ = conn.Close()

	s.writer = &kafka.Writer{
		Addr:     kafka.TCP(s.broker),
		Balancer: &kafka.LeastBytes{},
	}

	fmt.Printf("connected to Kafka: %v\n", s.broker)
	return nil
}

func (s *store) WriteMessage(event string, topic string) error {
	if s.writer == nil {
		return fmt.Errorf("not connected")
	}
	fmt.Printf("Delivering to topic %v\n", topic)
	err := s.writer.WriteMessages(context.Background(),
		kafka.Message{Topic: topic, Value: []byte(event)},
	)
	if err != nil {
		fmt.Printf("Delivery failed: %v\n", err)
		return err
	}
	fmt.Printf("Delivered to topic %v\n", topic)
	return nil
}

func (s *store) SubscribeToEvents(topic string) error {
	if s.reader != nil {
		s.reader.Close()
	}
	s.reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{s.broker},
		Topic:   topic,
		GroupID: s.groupId,
	})
	fmt.Printf("Subscribed to topic: %s\n", topic)
	for {
		msg, err := s.reader.ReadMessage(context.Background())
		if err != nil {
			fmt.Printf("Consumer error: %v\n", err)
			_ = s.reader.Close()
			s.reader = nil
			return err
		}
		fmt.Printf("Message on %s: %s\n", msg.Topic, string(msg.Value))
	}
}

func (s *store) Close() error {
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
