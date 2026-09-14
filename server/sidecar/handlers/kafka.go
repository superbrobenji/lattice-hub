package handlers

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/segmentio/kafka-go"
)

type KafkaHandler struct {
	broker string
}

func NewKafkaHandler(broker string) *KafkaHandler {
	return &KafkaHandler{broker: broker}
}

func (h *KafkaHandler) Status(w http.ResponseWriter, r *http.Request) {
	conn, err := kafka.DialContext(context.Background(), "tcp", h.broker)
	if err != nil {
		WriteJSON(w, http.StatusOK, map[string]interface{}{
			"reachable": false,
			"error":     err.Error(),
		})
		return
	}
	defer func() { _ = conn.Close() }()

	partitions, err := conn.ReadPartitions("motion-trigger")
	if err != nil {
		WriteJSON(w, http.StatusOK, map[string]interface{}{
			"reachable": true,
			"topics":    map[string]interface{}{"motion-trigger": "error reading partitions"},
		})
		return
	}

	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"reachable":  true,
		"broker":     h.broker,
		"partitions": len(partitions),
		"checkedAt":  time.Now().Unix(),
	})
}

// recentEventsReaderConfig builds the kafka.ReaderConfig used by RecentEvents.
//
// kafka.Reader prefetches: as soon as ReadMessage returns the topic's last
// existing message, the reader's background goroutine has already issued the
// *next* Fetch call to the broker. reader.Close() waits for that in-flight
// Fetch to return before it can return itself. The broker only replies once
// it has data or MaxWait elapses, and kafka-go's default MaxWait is 10s — so
// with the zero-value config, RecentEvents (which always defer-Closes the
// reader) would take ~9-10s to respond whenever there is no newer message on
// the topic, even though the actual read only takes milliseconds. Capping
// MaxWait keeps that trailing Fetch — and so Close() — short.
func recentEventsReaderConfig(broker string) kafka.ReaderConfig {
	return kafka.ReaderConfig{
		Brokers:   []string{broker},
		Topic:     "motion-trigger",
		Partition: 0,
		MaxBytes:  1024 * 1024,
		MaxWait:   500 * time.Millisecond,
	}
}

func (h *KafkaHandler) RecentEvents(w http.ResponseWriter, r *http.Request) {
	n := 50
	if nStr := r.URL.Query().Get("n"); nStr != "" {
		if parsed, err := strconv.Atoi(nStr); err == nil && parsed > 0 && parsed <= 500 {
			n = parsed
		}
	}

	empty := map[string]interface{}{"topic": "motion-trigger", "events": []interface{}{}, "count": 0}

	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()

	// Determine how many messages exist before reading, so ReadMessage never blocks
	// waiting for new messages.
	conn, err := kafka.DialLeader(ctx, "tcp", h.broker, "motion-trigger", 0)
	if err != nil {
		WriteJSON(w, http.StatusOK, empty)
		return
	}
	defer func() { _ = conn.Close() }()

	lastOffset, err := conn.ReadLastOffset()
	if err != nil || lastOffset == 0 {
		WriteJSON(w, http.StatusOK, empty)
		return
	}

	startOffset := lastOffset - int64(n)
	if startOffset < 0 {
		startOffset = 0
	}
	toRead := lastOffset - startOffset

	reader := kafka.NewReader(recentEventsReaderConfig(h.broker))
	defer func() { _ = reader.Close() }()

	if err := reader.SetOffset(startOffset); err != nil {
		WriteJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to seek"})
		return
	}

	events := make([]map[string]interface{}, 0, toRead)
	for i := int64(0); i < toRead; i++ {
		msg, err := reader.ReadMessage(ctx)
		if err != nil {
			break
		}
		events = append(events, map[string]interface{}{
			"offset":    msg.Offset,
			"timestamp": msg.Time.Unix(),
			"value":     string(msg.Value),
		})
	}

	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"topic":  "motion-trigger",
		"events": events,
		"count":  len(events),
	})
}
