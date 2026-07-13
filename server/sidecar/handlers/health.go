package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/docker/docker/client"
	kafka "github.com/segmentio/kafka-go"
)

type HealthHandler struct {
	docker     *client.Client
	broker     string
	httpClient *http.Client
}

func NewHealthHandler(docker *client.Client, broker string) *HealthHandler {
	return &HealthHandler{
		docker:     docker,
		broker:     broker,
		httpClient: &http.Client{Timeout: 5 * time.Second},
	}
}

type ServiceHealth struct {
	Name         string      `json:"name"`
	DockerState  string      `json:"dockerState"`
	DockerHealth string      `json:"dockerHealth"`
	HTTPStatus   *int        `json:"httpStatus,omitempty"`
	LatencyMs    *int64      `json:"latencyMs,omitempty"`
	Detail       interface{} `json:"detail"`
	CheckedAt    string      `json:"checkedAt"`
}

type serviceSpec struct {
	name    string
	httpURL string // empty = no HTTP probe
}

func (h *HealthHandler) Services(w http.ResponseWriter, r *http.Request) {
	specs := []serviceSpec{
		{name: "orchestrator", httpURL: "http://orchestrator:8080/health"},
		{name: "kafka", httpURL: ""},
		{name: "dashboard", httpURL: "http://dashboard:3000/"},
		{name: "artist-portal", httpURL: "http://artist-portal:3001/"},
		{name: "sidecar", httpURL: ""},
	}

	results := make([]ServiceHealth, len(specs))
	var wg sync.WaitGroup
	for i, spec := range specs {
		wg.Add(1)
		go func(idx int, s serviceSpec) {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
			defer cancel()
			results[idx] = h.probeService(ctx, s)
		}(i, spec)
	}
	wg.Wait()

	WriteJSON(w, http.StatusOK, map[string]interface{}{"services": results})
}

func (h *HealthHandler) probeService(ctx context.Context, spec serviceSpec) ServiceHealth {
	svc := ServiceHealth{
		Name:         spec.name,
		DockerState:  "unknown",
		DockerHealth: "unknown",
		Detail:       map[string]interface{}{},
		CheckedAt:    time.Now().UTC().Format(time.RFC3339),
	}

	// Docker state
	info, err := h.docker.ContainerInspect(ctx, spec.name)
	if err == nil {
		svc.DockerState = info.State.Status
		if info.State.Health != nil {
			svc.DockerHealth = info.State.Health.Status
		} else {
			svc.DockerHealth = "none"
		}
	}

	// Per-service probes
	switch spec.name {
	case "kafka":
		svc.Detail = h.probeKafka(ctx)
	case "sidecar":
		// self — no external probe
	default:
		if spec.httpURL != "" {
			status, latency, detail := h.probeHTTP(ctx, spec.httpURL)
			svc.HTTPStatus = &status
			svc.LatencyMs = &latency
			svc.Detail = detail
		}
	}

	return svc
}

func (h *HealthHandler) probeHTTP(ctx context.Context, url string) (status int, latencyMs int64, detail interface{}) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		s := 0
		return s, 0, map[string]string{"error": err.Error()}
	}
	start := time.Now()
	resp, err := h.httpClient.Do(req)
	latencyMs = time.Since(start).Milliseconds()
	if err != nil {
		s := 0
		return s, latencyMs, map[string]string{"error": err.Error()}
	}
	defer func() { _ = resp.Body.Close() }()
	status = resp.StatusCode

	// For orchestrator /health, decode JSON body
	if resp.Header.Get("Content-Type") == "application/json" {
		var body interface{}
		if err := json.NewDecoder(resp.Body).Decode(&body); err == nil {
			detail = body
			return status, latencyMs, detail
		}
	}
	return status, latencyMs, map[string]interface{}{}
}

func (h *HealthHandler) probeKafka(ctx context.Context) interface{} {
	conn, err := kafka.DialContext(ctx, "tcp", h.broker)
	if err != nil {
		return map[string]interface{}{"reachable": false, "error": err.Error()}
	}
	defer func() { _ = conn.Close() }()
	partitions, err := conn.ReadPartitions()
	if err != nil {
		return map[string]interface{}{"reachable": true, "broker": h.broker, "error": fmt.Sprintf("partitions: %v", err)}
	}
	topicCount := map[string]int{}
	for _, p := range partitions {
		topicCount[p.Topic]++
	}
	return map[string]interface{}{
		"reachable":  true,
		"broker":     h.broker,
		"partitions": len(partitions),
		"topicCount": topicCount,
	}
}
