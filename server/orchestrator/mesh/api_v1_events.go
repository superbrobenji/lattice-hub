package mesh

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// eventPayload returns the event's data with a top-level RFC 3339 UTC
// "timestamp" taken from the envelope when the publisher did not set one, so
// every SSE event tells clients when it happened rather than when it was
// rendered. Data that is not a JSON object is passed through unchanged.
func eventPayload(e Event) ([]byte, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(e.Data, &fields); err != nil || fields == nil {
		return json.Marshal(e.Data)
	}
	if _, ok := fields["timestamp"]; !ok {
		ts, err := json.Marshal(e.Timestamp.UTC().Format(time.RFC3339))
		if err != nil {
			return nil, err
		}
		fields["timestamp"] = ts
	}
	return json.Marshal(fields)
}

func (api *APIServer) v1Events(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering if behind proxy

	ch := api.meshServer.GetEventBroker().Subscribe()
	defer api.meshServer.GetEventBroker().Unsubscribe(ch)

	for {
		select {
		case event, open := <-ch:
			if !open {
				return
			}
			data, err := eventPayload(event)
			if err != nil {
				continue
			}
			_, _ = fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event.Type, data)
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}
