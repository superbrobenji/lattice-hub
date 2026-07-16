package mesh

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestCORSPreflight_ThroughRouter_AllowedOrigin exercises a real CORS
// preflight (OPTIONS + Origin + Access-Control-Request-Method) through the
// full instrumented router (api.ServeHTTP), the same path a browser takes
// before an artist-portal command POST to /api/v1/nodes/{id}/command.
//
// Regression for: gorilla/mux only invokes router-level middleware
// (including CORSMiddleware) after a route match is found. Every route was
// registered with an explicit .Methods("POST"/"GET"/...) list that never
// included OPTIONS, so a preflight request matched nothing and fell through
// to mux's bare NotFoundHandler — 404, no CORS headers, before
// CORSMiddleware ever ran. This must return a 2xx with the CORS headers
// present for an allowed origin.
func TestCORSPreflight_ThroughRouter_AllowedOrigin(t *testing.T) {
	ms := newTestMeshServer(t)
	api := NewAPIServer(ms, "test-key", "", []string{"http://localhost:3001"})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/nodes/1/command", nil)
	req.Header.Set("Origin", "http://localhost:3001")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "content-type")

	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code < 200 || w.Code >= 300 {
		t.Fatalf("preflight OPTIONS /api/v1/nodes/1/command: got status %d, want 2xx (body: %s)", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3001" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "http://localhost:3001")
	}
	if got := w.Header().Get("Access-Control-Allow-Methods"); got == "" {
		t.Errorf("Access-Control-Allow-Methods missing, want a non-empty value")
	}
}

// TestCORSPreflight_ThroughRouter_ZonesCommand covers the second command
// entrypoint the artist portal calls from ZoneCard — same router-wide bug,
// different route, to make sure the fix isn't accidentally scoped to a
// single path.
func TestCORSPreflight_ThroughRouter_ZonesCommand(t *testing.T) {
	ms := newTestMeshServer(t)
	api := NewAPIServer(ms, "test-key", "", []string{"http://localhost:3001"})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/zones/1/command", nil)
	req.Header.Set("Origin", "http://localhost:3001")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	req.Header.Set("Access-Control-Request-Headers", "content-type")

	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code < 200 || w.Code >= 300 {
		t.Fatalf("preflight OPTIONS /api/v1/zones/1/command: got status %d, want 2xx (body: %s)", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:3001" {
		t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, "http://localhost:3001")
	}
}

// TestCORSPreflight_ThroughRouter_DisallowedOrigin verifies the security
// property the fix must preserve: preflights from an origin not in the
// configured allowlist must never receive an Access-Control-Allow-Origin
// header, regardless of the HTTP status returned. Absence of the header is
// what makes the browser refuse the follow-up POST — the allowlist policy
// must not widen as a side effect of making preflights routable.
func TestCORSPreflight_ThroughRouter_DisallowedOrigin(t *testing.T) {
	ms := newTestMeshServer(t)
	api := NewAPIServer(ms, "test-key", "", []string{"http://localhost:3001"})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/nodes/1/command", nil)
	req.Header.Set("Origin", "http://evil.example.com")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)

	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if got := w.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q for disallowed origin, want empty", got)
	}
}

// TestCORSPreflight_ThroughRouter_NoAuthRequired verifies preflights are not
// blocked by AuthMiddleware. Browsers never send Authorization on an OPTIONS
// preflight, so if the CORS response depended on auth-protected routing, a
// real preflight would 401 instead of 204/2xx.
func TestCORSPreflight_ThroughRouter_NoAuthRequired(t *testing.T) {
	ms := newTestMeshServer(t)
	api := NewAPIServer(ms, "test-key", "", []string{"http://localhost:3001"})

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/nodes/1/command", nil)
	req.Header.Set("Origin", "http://localhost:3001")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	// Deliberately no Authorization header — browsers never send one on preflight.

	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code == http.StatusUnauthorized {
		t.Fatalf("preflight without Authorization got 401 — CORS must short-circuit before auth middleware")
	}
	if w.Code < 200 || w.Code >= 300 {
		t.Fatalf("preflight without Authorization: got status %d, want 2xx", w.Code)
	}
}
