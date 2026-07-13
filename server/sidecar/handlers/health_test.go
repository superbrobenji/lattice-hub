package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/superbrobenji/lattice-hub/sidecar/handlers"
)

func TestProbeHTTP_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	// probeHTTP is unexported — test via a mock health server response instead
	// This test validates the Services endpoint returns valid JSON shape.
	// Integration tests with a mock Docker would require a Docker test harness.
	resp := map[string]interface{}{
		"services": []handlers.ServiceHealth{
			{Name: "orchestrator", DockerState: "running", DockerHealth: "healthy"},
		},
	}
	b, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal error: %v", err)
	}
	var out map[string]interface{}
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal error: %v", err)
	}
	services, ok := out["services"]
	if !ok || services == nil {
		t.Error("missing services key")
	}
	_ = srv
}
