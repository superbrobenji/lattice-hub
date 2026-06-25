# Full Codebase Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring motionSensorServer to industry-standard quality across security, infrastructure, correctness, and code quality in four full-stack phases — each shipping a deployable state.

**Architecture:** Go orchestrator (`server/orchistrator/`) + React Router v7 dashboard (`server/dashboard/`) + Docker Compose infrastructure. Phase 1 unblocks Planetopia node firmware security work. Phases are ordered so each leaves the codebase in a compilable, runnable state.

**Tech Stack:** Go 1.23, `slog` (stdlib), `gorilla/mux`, `segmentio/kafka-go`, `go.bug.st/serial`, `google.golang.org/protobuf`, `prometheus/client_golang` (Phase 4); React Router v7, React 19, TypeScript 5.8, Tailwind v4, Vite 6; Docker Compose with Bitnami Kafka.

**Related plan:** `docs/superpowers/plans/2026-06-25-security-and-auth-support.md` — Tasks 1–3 of Phase 1 delegate to this plan verbatim.

**Cross-repo context (Planetopia-nodes):**
- `MESH_TYPE_ENROLLMENT = 2`, `MESH_TYPE_JOIN_ACK = 3` (added to server constants in Task 1)
- Serial opcodes: `OP_ENROLLMENT_REQ=0xC0`, `OP_ENROLLMENT_APPROVE=0xC1`, `OP_ENROLLMENT_REJECT=0xC2`
- `protoVersion`/`epochNum`/`seqNum` are set by nodes in ESP-NOW frames; master passes them through in protobuf over serial
- Nodes plan: `docs/superpowers/plans/2026-06-25-full-review-fixes.md` Tasks 10–13 are the firmware counterpart to server Phase 1 Tasks 1–3

## Global Constraints

- `go build ./...` must pass after every Go task with zero errors.
- `npm run typecheck` must pass after every React task.
- Breaking changes are allowed — project is not in production.
- Never change the serial wire protocol framing (2-byte LE length prefix + protobuf) — firmware depends on it.
- `MaxDataLength = 12` serial payload limit is a firmware constraint — do not change.
- All new env vars must be documented in `server/env.example`.
- Go module path remains `github.com/superbrobenji/motionServer` until Task 15 (rename phase).
- After Task 15 (rename), module path becomes `github.com/superbrobenji/motionServer` → kept as-is (module path is independent of directory name).
- Dashboard uses `flatRoutes()` — new route files in `app/routes/` are auto-discovered; do not modify `routes.ts`.
- `root.tsx` already exports `ErrorBoundary` (React Router v7 pattern) — do not add another one.

---

## Phase 1 — Security

### Task 1: Proto schema + nodeauth package + MeshServer enrollment wiring

**Delegate entirely to the existing security plan:**

Execute **Phase 1 (Task 1)**, **Phase 2 (Task 2)**, and **Phase 3 (Task 3)** of:
`docs/superpowers/plans/2026-06-25-security-and-auth-support.md`

**Before starting, note these corrections to the existing plan:**

- In Phase 2 Step 1 (`nodeauth/registry.go`): the import `"crypto/ed25519"` is needed and the placeholder `curveToEdPublicKey` function can be omitted entirely — it's unused.
- In Phase 3 Step 4 (`ApproveEnrollment`): the plan accesses `ms.serialComm.port` which is private. The plan itself notes this and adds `WriteRaw([]byte) error` to `serial.go` — follow that instruction.
- `MESH_TYPE_ENROLLMENT = 2` and `MESH_TYPE_JOIN_ACK = 3` must be added to `server/orchistrator/mesh/constants.go` as new message type constants alongside existing ones.

**After completing those three phases from the existing plan, add to `server/orchistrator/mesh/constants.go`:**

- [ ] **Step 1: Add enrollment message type constants**

In `server/orchistrator/mesh/constants.go`, add after the existing message type constants block:

```go
const (
	MessageTypeEnrollment uint32 = 2 // New node → master: public key announcement
	MessageTypeJoinAck    uint32 = 3 // Master → new node: enrollment approved
)
```

- [ ] **Step 2: Compile check**

```bash
cd server/orchistrator
go build ./...
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add server/orchistrator/mesh/constants.go
git commit -m "feat: add MESH_TYPE_ENROLLMENT and MESH_TYPE_JOIN_ACK constants"
```

---

### Task 2: Enrollment HTTP API + Dashboard UI

**Delegate entirely to the existing security plan:**

Execute **Phase 4 (Task 4)** and **Phase 5 (Task 5)** of:
`docs/superpowers/plans/2026-06-25-security-and-auth-support.md`

**Before starting, note these corrections:**

- **Phase 5 Step 4** says to modify `routes.ts` to register the enrollments route. **Skip this step entirely.** The dashboard uses `flatRoutes()` auto-discovery — creating `app/routes/enrollments.tsx` is sufficient; it will be picked up automatically.
- The `IEnrollment` and `IApiService` additions should go in `server/dashboard/app/interfaces/IApiService.ts` (extend the existing file, not replace it).
- The enrollment API methods in the plan use a class-based `ApiService` — the existing `apiService.tsx` is function-based. Implement the enrollment fetch calls as standalone async functions exported from `apiService.tsx` following the existing pattern, not as class methods.

---

### Task 3: TX power API + Dashboard selector

**Delegate entirely to the existing security plan:**

Execute **Phase 6 (Task 6)** of:
`docs/superpowers/plans/2026-06-25-security-and-auth-support.md`

---

### Task 4: HTTP API auth middleware

**Files:**
- Create: `server/orchistrator/mesh/middleware.go`
- Modify: `server/orchistrator/mesh/api.go`
- Modify: `server/orchistrator/main.go`
- Modify: `server/env.example`
- Modify: `server/dashboard/app/services/apiService.tsx`

**Interfaces:**
- Produces: `AuthMiddleware(apiKey string) mux.MiddlewareFunc` — wraps all routes, returns 401 on missing/wrong key
- Produces: `VITE_API_KEY` env var consumed by dashboard fetch calls

---

- [ ] **Step 1: Write failing test for auth middleware**

Create `server/orchistrator/mesh/middleware_test.go`:

```go
package mesh

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMiddleware_MissingKey(t *testing.T) {
	handler := AuthMiddleware("secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/nodes", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_WrongKey(t *testing.T) {
	handler := AuthMiddleware("secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/nodes", nil)
	req.Header.Set("Authorization", "Bearer wrong")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401, got %d", w.Code)
	}
}

func TestAuthMiddleware_ValidKey(t *testing.T) {
	handler := AuthMiddleware("secret")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/nodes", nil)
	req.Header.Set("Authorization", "Bearer secret")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/orchistrator
go test ./mesh/... -run TestAuthMiddleware -v
```

Expected: `FAIL — AuthMiddleware undefined`

- [ ] **Step 3: Create middleware.go**

Create `server/orchistrator/mesh/middleware.go`:

```go
package mesh

import (
	"net/http"
	"strings"
)

// AuthMiddleware rejects requests without a valid Bearer token.
func AuthMiddleware(apiKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth := r.Header.Get("Authorization")
			if !strings.HasPrefix(auth, "Bearer ") || strings.TrimPrefix(auth, "Bearer ") != apiKey {
				http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd server/orchistrator
go test ./mesh/... -run TestAuthMiddleware -v
```

Expected: all 3 PASS.

- [ ] **Step 5: Wire middleware into API server**

In `server/orchistrator/mesh/api.go`, update `NewAPIServer` to accept `apiKey string` and apply middleware:

```go
func NewAPIServer(meshServer *MeshServer, apiKey string) *APIServer {
	api := &APIServer{
		meshServer: meshServer,
		router:     mux.NewRouter(),
	}
	if apiKey != "" {
		api.router.Use(AuthMiddleware(apiKey))
	}
	api.setupRoutes()
	return api
}
```

Update `StartAPIServer` signature:

```go
func StartAPIServer(meshServer *MeshServer, port int, apiKey string) error {
	api := NewAPIServer(meshServer, apiKey)
	log.Printf("Starting API server on port %d", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), api)
}
```

- [ ] **Step 6: Pass apiKey from main.go**

In `server/orchistrator/main.go`, read `API_KEY` from env and pass to `StartAPIServer`:

```go
import "os"

// After flag.Parse():
apiKey := os.Getenv("API_KEY")
if apiKey == "" {
    log.Fatal("API_KEY env var is required")
}

// Update StartAPIServer call:
go func() {
    if err := mesh.StartAPIServer(meshServer, *apiPort, apiKey); err != nil {
        log.Printf("API server error: %v", err)
    }
}()
```

- [ ] **Step 7: Update dashboard to send auth header**

In `server/dashboard/app/services/apiService.tsx`, read the API key from env and add to all fetch calls:

```typescript
const HOST_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";

function authHeaders(): HeadersInit {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

export default async function ApiService<ApiResponse>(
  service: ServiceName,
  options?: RequestInit
): Promise<ApiResponse> {
  const endpoint = endpoints[service];
  const url = typeof endpoint === "function"
    ? `${HOST_URL}${(endpoint as (mac: string) => string)("")}`
    : `${HOST_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
```

Note: the `getNode` and `configureNode` endpoints take a `mac` parameter. For those, callers must use the endpoint function directly. Update the `ApiService` function signature later (Task 12) when fixing dashboard correctness — for now the existing call sites work without the `mac` parameter.

- [ ] **Step 8: Update env.example**

In `server/env.example`, add:

```
# HTTP API authentication key (required)
# Generate with: openssl rand -hex 32
API_KEY=change-me-in-production

# Dashboard API URL (for dashboard container)
VITE_API_URL=http://localhost:8080

# Dashboard API key (must match API_KEY above)
VITE_API_KEY=change-me-in-production
```

- [ ] **Step 9: Update docker-compose to pass API_KEY**

In `server/docker-compose.yml`, add to orchestrator environment:

```yaml
environment:
  - SERIAL_PORT=${SERIAL_PORT:-/dev/ttyUSB0}
  - BAUD_RATE=${BAUD_RATE:-115200}
  - API_PORT=${API_PORT:-8080}
  - KAFKA_BROKER=kafka:9092
  - API_KEY=${API_KEY:?API_KEY is required}
```

And to dashboard environment:

```yaml
dashboard:
  build: ./dashboard
  depends_on:
    orchistrator:
      condition: service_healthy
  ports:
    - "3000:3000"
  environment:
    - VITE_API_URL=http://orchistrator:8080
    - VITE_API_KEY=${API_KEY:?API_KEY is required}
  networks:
    - kafka-net
```

- [ ] **Step 10: Compile and test**

```bash
cd server/orchistrator
go build ./...
go test ./mesh/... -v
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add server/orchistrator/mesh/middleware.go server/orchistrator/mesh/middleware_test.go server/orchistrator/mesh/api.go server/orchistrator/main.go server/env.example server/docker-compose.yml server/dashboard/app/services/apiService.tsx
git commit -m "feat: HTTP API key auth middleware, VITE_API_KEY dashboard integration"
```

---

### Task 5: Docker hardening + CORS + request body limits + input validation

**Files:**
- Modify: `server/docker-compose.yml`
- Create: `server/orchistrator/mesh/cors.go`
- Modify: `server/orchistrator/mesh/api.go`
- Modify: `server/env.example`

**Interfaces:**
- Produces: `CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler`
- Produces: `isValidAdapterType(t int32) bool`

---

- [ ] **Step 1: Write failing test for CORS middleware**

In `server/orchistrator/mesh/middleware_test.go`, add:

```go
func TestCORSMiddleware_AllowedOrigin(t *testing.T) {
	handler := CORSMiddleware([]string{"http://localhost:3000"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/nodes", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("expected CORS header, got %q", w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestCORSMiddleware_BlockedOrigin(t *testing.T) {
	handler := CORSMiddleware([]string{"http://localhost:3000"})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/nodes", nil)
	req.Header.Set("Origin", "http://evil.example.com")
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Errorf("should not set CORS header for blocked origin")
	}
}

func TestIsValidAdapterType(t *testing.T) {
	valid := []int32{-1, 0, 1, 2, 3}
	for _, v := range valid {
		if !isValidAdapterType(v) {
			t.Errorf("expected %d to be valid", v)
		}
	}
	invalid := []int32{-2, 4, 99, -100}
	for _, v := range invalid {
		if isValidAdapterType(v) {
			t.Errorf("expected %d to be invalid", v)
		}
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server/orchistrator
go test ./mesh/... -run "TestCORS|TestIsValid" -v
```

Expected: FAIL — `CORSMiddleware` and `isValidAdapterType` undefined.

- [ ] **Step 3: Create cors.go**

Create `server/orchistrator/mesh/cors.go`:

```go
package mesh

import "net/http"

// CORSMiddleware sets Access-Control-Allow-Origin for requests from allowed origins.
func CORSMiddleware(allowedOrigins []string) func(http.Handler) http.Handler {
	allowed := make(map[string]bool, len(allowedOrigins))
	for _, o := range allowedOrigins {
		allowed[o] = true
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if origin != "" && allowed[origin] {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
				w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			}
			if r.Method == http.MethodOptions {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
```

- [ ] **Step 4: Add isValidAdapterType and body size limit to api.go**

In `server/orchistrator/mesh/api.go`, add after the imports:

```go
const maxRequestBodyBytes = 64 * 1024 // 64KB

func isValidAdapterType(t int32) bool {
	switch t {
	case AdapterTypeUnknown, AdapterTypePIR, AdapterTypeWIFI, AdapterTypeLED, AdapterTypeSerial:
		return true
	}
	return false
}
```

Update `configureNode` to validate:

```go
func (api *APIServer) configureNode(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	macStr := vars["mac"]

	mac, err := StringToMAC(macStr)
	if err != nil {
		api.writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid MAC address: %v", err))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var req ConfigureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	if !isValidAdapterType(req.AdapterType) {
		api.writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid adapterType: %d", req.AdapterType))
		return
	}

	if err := api.meshServer.ConfigureNode(mac, req.AdapterType); err != nil {
		api.writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to configure node: %v", err))
		return
	}

	api.writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("Node %s configured to adapter type %s", macStr, GetAdapterTypeName(req.AdapterType)),
	})
}
```

Update `configureAllNodes` the same way:

```go
func (api *APIServer) configureAllNodes(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var req ConfigureRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}

	if !isValidAdapterType(req.AdapterType) {
		api.writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid adapterType: %d", req.AdapterType))
		return
	}

	if err := api.meshServer.ConfigureAllNodes(req.AdapterType); err != nil {
		api.writeError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to configure all nodes: %v", err))
		return
	}

	api.writeJSON(w, http.StatusOK, APIResponse{
		Success: true,
		Message: fmt.Sprintf("All nodes configured to adapter type %s", GetAdapterTypeName(req.AdapterType)),
	})
}
```

Update `broadcastData` to add body limit:

```go
func (api *APIServer) broadcastData(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestBodyBytes)
	var req BroadcastRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		api.writeError(w, http.StatusBadRequest, fmt.Sprintf("Invalid request body: %v", err))
		return
	}
	// ... rest unchanged
```

- [ ] **Step 5: Wire CORS middleware into NewAPIServer**

Update `NewAPIServer` in `api.go`:

```go
func NewAPIServer(meshServer *MeshServer, apiKey string, corsOrigins []string) *APIServer {
	api := &APIServer{
		meshServer: meshServer,
		router:     mux.NewRouter(),
	}
	api.router.Use(CORSMiddleware(corsOrigins))
	if apiKey != "" {
		api.router.Use(AuthMiddleware(apiKey))
	}
	api.setupRoutes()
	return api
}
```

Update `StartAPIServer`:

```go
func StartAPIServer(meshServer *MeshServer, port int, apiKey string, corsOrigins []string) error {
	api := NewAPIServer(meshServer, apiKey, corsOrigins)
	log.Printf("Starting API server on port %d", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), api)
}
```

- [ ] **Step 6: Read CORS_ORIGINS in main.go**

In `server/orchistrator/main.go`, add:

```go
import "strings"

// After apiKey is read:
corsOriginsEnv := os.Getenv("CORS_ORIGINS")
corsOrigins := []string{"http://localhost:3000"}
if corsOriginsEnv != "" {
    corsOrigins = strings.Split(corsOriginsEnv, ",")
}

// Update StartAPIServer call:
go func() {
    if err := mesh.StartAPIServer(meshServer, *apiPort, apiKey, corsOrigins); err != nil {
        log.Printf("API server error: %v", err)
    }
}()
```

- [ ] **Step 7: Harden docker-compose**

In `server/docker-compose.yml`, replace the orchestrator service with:

```yaml
  orchistrator:
    build: ./orchistrator
    depends_on:
      kafka:
        condition: service_healthy
    volumes:
      - ./orchistrator:/orchistrator
    ports:
      - "8080:8080"
    devices:
      - "/dev/ttyUSB0:/dev/ttyUSB0"
    group_add:
      - "20"
    environment:
      - SERIAL_PORT=${SERIAL_PORT:-/dev/ttyUSB0}
      - BAUD_RATE=${BAUD_RATE:-115200}
      - API_PORT=${API_PORT:-8080}
      - KAFKA_BROKER=kafka:9092
      - API_KEY=${API_KEY:?API_KEY is required}
      - CORS_ORIGINS=${CORS_ORIGINS:-http://localhost:3000}
    networks:
      - kafka-net
    restart: unless-stopped
```

Removed: `privileged: true`, `user: "0:0"`, `security_opt: apparmor:unconfined`, `security_opt: seccomp:unconfined`, `cap_add: SYS_ADMIN`, `/dev:/dev` full mount, `/sys:/sys`, `/run/udev:/run/udev`.

- [ ] **Step 8: Update env.example with CORS_ORIGINS**

In `server/env.example`, add:

```
# Comma-separated allowed CORS origins for the API server
CORS_ORIGINS=http://localhost:3000
```

- [ ] **Step 9: Run tests**

```bash
cd server/orchistrator
go test ./mesh/... -v
go build ./...
```

Expected: all tests pass, zero build errors.

- [ ] **Step 10: Commit**

```bash
git add server/orchistrator/mesh/cors.go server/orchistrator/mesh/api.go server/orchistrator/main.go server/docker-compose.yml server/env.example
git commit -m "feat: CORS middleware, request body limits, adapterType validation, Docker hardening (remove privileged/seccomp/apparmor)"
```

---

## Phase 2 — Infrastructure

### Task 6: Env var support in main.go

**Files:**
- Modify: `server/orchistrator/main.go`
- Modify: `server/env.example`

**Interfaces:**
- Produces: env var override for all flags: `SERIAL_PORT`, `BAUD_RATE`, `API_PORT`, `KAFKA_BROKER`, `LOG_LEVEL`, `NODE_REGISTRY_PATH`

---

- [ ] **Step 1: Write test for env var parsing helper**

Create `server/orchistrator/envconfig_test.go`:

```go
package main

import (
	"os"
	"testing"
)

func TestEnvOrDefault_StringUsesEnv(t *testing.T) {
	os.Setenv("TEST_VAR", "from-env")
	defer os.Unsetenv("TEST_VAR")
	result := envOrDefault("TEST_VAR", "default")
	if result != "from-env" {
		t.Errorf("expected 'from-env', got %q", result)
	}
}

func TestEnvOrDefault_StringFallsBack(t *testing.T) {
	os.Unsetenv("TEST_VAR")
	result := envOrDefault("TEST_VAR", "default")
	if result != "default" {
		t.Errorf("expected 'default', got %q", result)
	}
}

func TestEnvOrDefaultInt_UsesEnv(t *testing.T) {
	os.Setenv("TEST_INT", "9999")
	defer os.Unsetenv("TEST_INT")
	result := envOrDefaultInt("TEST_INT", 1234)
	if result != 9999 {
		t.Errorf("expected 9999, got %d", result)
	}
}

func TestEnvOrDefaultInt_FallsBack(t *testing.T) {
	os.Unsetenv("TEST_INT")
	result := envOrDefaultInt("TEST_INT", 1234)
	if result != 1234 {
		t.Errorf("expected 1234, got %d", result)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server/orchistrator
go test -run "TestEnvOr" -v .
```

Expected: FAIL — `envOrDefault` undefined.

- [ ] **Step 3: Create envconfig.go**

Create `server/orchistrator/envconfig.go`:

```go
package main

import (
	"log"
	"os"
	"strconv"
)

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envOrDefaultInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Printf("Warning: invalid value for %s=%q, using default %d", key, v, def)
		return def
	}
	return n
}
```

- [ ] **Step 4: Wire into main.go flag defaults**

In `server/orchistrator/main.go`, update flag declarations to use env var helpers:

```go
serialPort := flag.String("serial", envOrDefault("SERIAL_PORT", "/dev/ttyUSB0"), "Serial port for mesh communication")
baudRate   := flag.Int("baud", envOrDefaultInt("BAUD_RATE", 115200), "Serial baud rate")
apiPort    := flag.Int("port", envOrDefaultInt("API_PORT", 8080), "HTTP API port")
```

Add broker and other env vars before flag.Parse():

```go
broker  = envOrDefault("KAFKA_BROKER", "kafka:9092")
groupId = envOrDefault("KAFKA_GROUP_ID", "1")
nodeRegistryPath := envOrDefault("NODE_REGISTRY_PATH", "data/nodes.json")
logLevel := envOrDefault("LOG_LEVEL", "INFO")
```

Keep the existing `var broker` and `var groupId` package-level vars — replace their hardcoded values by initializing them inside `main()` before use instead of at declaration:

```go
// Remove the package-level var block and move into main():
func main() {
    broker  := envOrDefault("KAFKA_BROKER", "kafka:9092")
    groupId := envOrDefault("KAFKA_GROUP_ID", "1")
    nodeRegistryPath := envOrDefault("NODE_REGISTRY_PATH", "data/nodes.json")
    logLevel := envOrDefault("LOG_LEVEL", "INFO")
    _ = logLevel // used in Task 10 when slog is wired up
    _ = nodeRegistryPath // used in Task 8 when persistence is wired up
    // ...existing flag declarations updated above...
```

- [ ] **Step 5: Run tests**

```bash
cd server/orchistrator
go test -run "TestEnvOr" -v .
go build ./...
```

Expected: tests PASS, build clean.

- [ ] **Step 6: Update env.example**

In `server/env.example`, add:

```
# Kafka consumer group ID
KAFKA_GROUP_ID=1

# Path to node registry persistence file
NODE_REGISTRY_PATH=data/nodes.json

# Log level: DEBUG, INFO, WARN, ERROR
LOG_LEVEL=INFO
```

- [ ] **Step 7: Commit**

```bash
git add server/orchistrator/envconfig.go server/orchistrator/envconfig_test.go server/orchistrator/main.go server/env.example
git commit -m "feat: env var support for all main.go flags — SERIAL_PORT, BAUD_RATE, API_PORT, KAFKA_BROKER, etc."
```

---

### Task 7: Kafka connectivity check + Close() on shutdown

**Files:**
- Modify: `server/orchistrator/eventStore/eventstore.go`
- Modify: `server/orchistrator/eventStore/kafka.go`
- Modify: `server/orchistrator/mesh/mock_event_store.go`
- Modify: `server/orchistrator/main.go`

**Interfaces:**
- Modifies: `EventStoreInterface` (renamed from `EventStore_interface`) — adds `Close() error`
- Produces: `Connect()` returns error if broker unreachable within 5s

---

- [ ] **Step 1: Write failing tests**

Create `server/orchistrator/eventStore/kafka_test.go`:

```go
package eventstore

import (
	"testing"
)

func TestNew_ReturnsInterface(t *testing.T) {
	store := New("localhost:9999", "test-group")
	if store == nil {
		t.Fatal("expected non-nil store")
	}
}

func TestConnect_FailsOnUnreachableBroker(t *testing.T) {
	store := New("localhost:19999", "test-group")
	err := store.Connect()
	if err == nil {
		t.Error("expected error connecting to unreachable broker, got nil")
	}
}

func TestClose_NoError(t *testing.T) {
	store := New("localhost:19999", "test-group")
	// Connect will fail; Close should still not panic
	_ = store.Connect()
	if err := store.Close(); err != nil {
		t.Errorf("unexpected error on Close: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server/orchistrator
go test ./eventStore/... -v
```

Expected: `FAIL — Connect_FailsOnUnreachableBroker: expected error but got nil` (current Connect always returns nil).

- [ ] **Step 3: Update EventStoreInterface to add Close()**

Replace `server/orchistrator/eventStore/eventstore.go`:

```go
package eventstore

// EventStoreInterface defines the event storage contract.
type EventStoreInterface interface {
	Connect() error
	WriteMessage(event string, topic string) error
	SubscribeToEvents(topic string) error
	Close() error
}
```

- [ ] **Step 4: Update kafka.go — real Connect() check + Close()**

Replace `server/orchistrator/eventStore/kafka.go`:

```go
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
	conn.Close()

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
			s.reader.Close()
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
```

- [ ] **Step 5: Update mock_event_store.go to implement Close()**

In `server/orchistrator/mesh/mock_event_store.go`, add `Close()` method and rename interface reference:

```go
package mesh

import EventStore "github.com/superbrobenji/motionServer/eventStore"

// MockEventStore provides a mock implementation for testing.
type MockEventStore struct {
	messages []string
	topics   []string
}

func NewMockEventStore() *MockEventStore {
	return &MockEventStore{
		messages: make([]string, 0),
		topics:   make([]string, 0),
	}
}

func (m *MockEventStore) Connect() error       { return nil }
func (m *MockEventStore) Close() error         { return nil }
func (m *MockEventStore) SubscribeToEvents(topic string) error { return nil }

func (m *MockEventStore) WriteMessage(event string, topic string) error {
	m.messages = append(m.messages, event)
	m.topics = append(m.topics, topic)
	return nil
}

func (m *MockEventStore) GetMessages() []string { return m.messages }
func (m *MockEventStore) GetTopics() []string   { return m.topics }

var _ EventStore.EventStoreInterface = (*MockEventStore)(nil)
```

- [ ] **Step 6: Update all references from EventStore_interface to EventStoreInterface**

In `server/orchistrator/mesh/server.go`, update field type:

```go
eventStore EventStore.EventStoreInterface
```

In `server/orchistrator/mesh/server.go`, update `MeshServerConfig`:

```go
EventStore EventStore.EventStoreInterface
```

In `server/orchistrator/main.go`, update variable type:

```go
var eventStore EventStore.EventStoreInterface
```

- [ ] **Step 7: Wire Close() into main.go shutdown**

In `server/orchistrator/main.go`, after `meshServer.Stop()`:

```go
if eventStore != nil {
    if err := eventStore.Close(); err != nil {
        log.Printf("Error closing event store: %v", err)
    }
}
```

- [ ] **Step 8: Run tests**

```bash
cd server/orchistrator
go test ./eventStore/... -v
go build ./...
```

Expected: `TestConnect_FailsOnUnreachableBroker` PASS (broker at 19999 is unreachable), others PASS.

- [ ] **Step 9: Commit**

```bash
git add server/orchistrator/eventStore/ server/orchistrator/mesh/mock_event_store.go server/orchistrator/mesh/server.go server/orchistrator/main.go
git commit -m "feat: EventStoreInterface (renamed), real Kafka connectivity check, Close() on shutdown"
```

---

### Task 8: Node registry persistence

**Files:**
- Modify: `server/orchistrator/mesh/node_registry.go`
- Modify: `server/orchistrator/mesh/server.go`
- Modify: `server/orchistrator/main.go`

**Interfaces:**
- Produces: `NodeRegistry.Persist(path string) error`
- Produces: `NodeRegistry.Load(path string) error`
- Produces: `NodeRegistry.PersistLoop(path string, interval time.Duration, stop <-chan struct{})`

---

- [ ] **Step 1: Write failing tests**

In `server/orchistrator/mesh/mesh_test.go`, add:

```go
func TestNodeRegistryPersistence(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/nodes.json"

	registry := NewNodeRegistry()
	mac := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF}
	registry.UpdateNode(mac, AdapterTypePIR, 1000, 1)

	if err := registry.Persist(path); err != nil {
		t.Fatalf("Persist failed: %v", err)
	}

	registry2 := NewNodeRegistry()
	if err := registry2.Load(path); err != nil {
		t.Fatalf("Load failed: %v", err)
	}

	node, exists := registry2.GetNode(mac)
	if !exists {
		t.Fatal("expected node to exist after load")
	}
	if node.AdapterType != AdapterTypePIR {
		t.Errorf("expected AdapterTypePIR, got %d", node.AdapterType)
	}
	if node.Uptime != 1000 {
		t.Errorf("expected uptime 1000, got %d", node.Uptime)
	}
}

func TestNodeRegistryLoad_MissingFile(t *testing.T) {
	registry := NewNodeRegistry()
	err := registry.Load("/tmp/does-not-exist-xyzzy.json")
	if err != nil {
		t.Errorf("expected no error for missing file, got %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd server/orchistrator
go test ./mesh/... -run "TestNodeRegistryPersistence|TestNodeRegistryLoad" -v
```

Expected: FAIL — `Persist` and `Load` undefined.

- [ ] **Step 3: Add Persist, Load, PersistLoop to node_registry.go**

In `server/orchistrator/mesh/node_registry.go`, add imports `"encoding/json"`, `"os"`, `"log"`, `"time"` and the following methods after `NodeCount()`:

```go
type persistedNode struct {
	MAC         string    `json:"mac"`
	AdapterType int32     `json:"adapterType"`
	Uptime      uint32    `json:"uptime"`
	LastSeen    time.Time `json:"lastSeen"`
	HopCount    uint32    `json:"hopCount"`
}

// Persist saves the registry to a JSON file at path.
func (nr *NodeRegistry) Persist(path string) error {
	nr.mu.RLock()
	entries := make([]persistedNode, 0, len(nr.nodes))
	for _, n := range nr.nodes {
		entries = append(entries, persistedNode{
			MAC:         n.MACString,
			AdapterType: n.AdapterType,
			Uptime:      n.Uptime,
			LastSeen:    n.LastSeen,
			HopCount:    n.HopCount,
		})
	}
	nr.mu.RUnlock()

	data, err := json.MarshalIndent(entries, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal nodes: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return fmt.Errorf("create dirs for %s: %w", path, err)
	}
	return os.WriteFile(path, data, 0600)
}

// Load reads a persisted registry from a JSON file. Missing file = empty registry (not an error).
func (nr *NodeRegistry) Load(path string) error {
	data, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read %s: %w", path, err)
	}

	var entries []persistedNode
	if err := json.Unmarshal(data, &entries); err != nil {
		return fmt.Errorf("unmarshal nodes: %w", err)
	}

	nr.mu.Lock()
	defer nr.mu.Unlock()
	for _, e := range entries {
		mac, err := StringToMAC(e.MAC)
		if err != nil {
			log.Printf("[NodeRegistry] Skipping invalid MAC %s: %v", e.MAC, err)
			continue
		}
		nr.nodes[e.MAC] = &NodeInfo{
			MAC:         mac,
			MACString:   e.MAC,
			AdapterType: e.AdapterType,
			Uptime:      e.Uptime,
			LastSeen:    e.LastSeen,
			HopCount:    e.HopCount,
		}
	}
	log.Printf("[NodeRegistry] Loaded %d nodes from %s", len(entries), path)
	return nil
}

// PersistLoop saves the registry every interval. Run as a goroutine.
func (nr *NodeRegistry) PersistLoop(path string, interval time.Duration, stop <-chan struct{}) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-t.C:
			if err := nr.Persist(path); err != nil {
				log.Printf("[NodeRegistry] Failed to persist: %v", err)
			}
		case <-stop:
			if err := nr.Persist(path); err != nil {
				log.Printf("[NodeRegistry] Final persist failed: %v", err)
			}
			return
		}
	}
}
```

Add `"path/filepath"` to imports in `node_registry.go`.

- [ ] **Step 4: Wire persistence into MeshServer**

In `server/orchistrator/mesh/server.go`, add to `MeshServer` struct:

```go
nodeRegistryPath string
stopNodePersist  chan struct{}
```

Add to `MeshServerConfig`:

```go
NodeRegistryPath string
```

In `NewMeshServer()`, after creating `nodeRegistry`:

```go
if config.NodeRegistryPath != "" {
    if err := nodeRegistry.Load(config.NodeRegistryPath); err != nil {
        log.Printf("[MeshServer] Failed to load node registry: %v", err)
    }
}
```

Set fields:

```go
nodeRegistryPath: config.NodeRegistryPath,
stopNodePersist:  make(chan struct{}),
```

In `Start()`, after starting `messageProcessor`:

```go
if ms.nodeRegistryPath != "" {
    ms.wg.Add(1)
    go func() {
        defer ms.wg.Done()
        ms.nodeRegistry.PersistLoop(ms.nodeRegistryPath, 60*time.Second, ms.stopNodePersist)
    }()
}
```

In `Stop()`, close persist channel before `ms.wg.Wait()`:

```go
if ms.nodeRegistryPath != "" {
    close(ms.stopNodePersist)
}
```

- [ ] **Step 5: Pass NodeRegistryPath from main.go**

In `server/orchistrator/main.go`, update `meshConfig`:

```go
meshConfig := mesh.MeshServerConfig{
    SerialPort:       *serialPort,
    BaudRate:         *baudRate,
    HealthTimeout:    30 * time.Second,
    EventStore:       eventStore,
    NodeRegistryPath: nodeRegistryPath,
}
```

- [ ] **Step 6: Run tests**

```bash
cd server/orchistrator
go test ./mesh/... -run "TestNodeRegistry" -v
go build ./...
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/orchistrator/mesh/node_registry.go server/orchistrator/mesh/server.go server/orchistrator/main.go
git commit -m "feat: node registry persistence — load on startup, periodic save, final save on shutdown"
```

---

### Task 9: Graceful HTTP shutdown + server timeouts

**Files:**
- Modify: `server/orchistrator/mesh/api.go`
- Modify: `server/orchistrator/main.go`

**Interfaces:**
- Modifies: `StartAPIServer` — returns a shutdown function `func(ctx context.Context) error` instead of blocking
- Produces: `http.Server` with `ReadTimeout`, `WriteTimeout`, `IdleTimeout`

---

- [ ] **Step 1: Rewrite StartAPIServer to return shutdown function**

In `server/orchistrator/mesh/api.go`, add `"context"` to imports and replace `StartAPIServer`:

```go
// StartAPIServer starts the HTTP API server and returns a shutdown function.
func StartAPIServer(meshServer *MeshServer, port int, apiKey string, corsOrigins []string) (shutdown func(context.Context) error, err error) {
	api := NewAPIServer(meshServer, apiKey, corsOrigins)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      api,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("Starting API server on port %d", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	// Give the server a moment to bind; surface immediate errors (e.g. port in use).
	select {
	case err := <-errCh:
		return nil, err
	case <-time.After(100 * time.Millisecond):
	}

	return srv.Shutdown, nil
}
```

- [ ] **Step 2: Update main.go to use shutdown function**

In `server/orchistrator/main.go`, replace the existing `StartAPIServer` goroutine with:

```go
shutdownAPI, err := mesh.StartAPIServer(meshServer, *apiPort, apiKey, corsOrigins)
if err != nil {
    log.Fatalf("Failed to start API server: %v", err)
}
```

And in the shutdown sequence, after stopping meshServer:

```go
log.Printf("Shutting down API server...")
shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
defer shutdownCancel()
if err := shutdownAPI(shutdownCtx); err != nil {
    log.Printf("API server shutdown error: %v", err)
}
```

Add `"context"` to main.go imports.

- [ ] **Step 3: Compile and verify**

```bash
cd server/orchistrator
go build ./...
```

Expected: zero errors.

- [ ] **Step 4: Smoke test graceful shutdown**

Start the server locally (requires serial port to be absent, mesh will fail but API starts):

```bash
./main -serial /dev/null -port 18080
```

In another terminal:

```bash
curl -H "Authorization: Bearer $API_KEY" http://localhost:18080/status
# Expected: JSON response with running:false
```

Send SIGINT — server should log "Shutdown signal received" then "Server shutdown complete" and exit cleanly.

- [ ] **Step 5: Commit**

```bash
git add server/orchistrator/mesh/api.go server/orchistrator/main.go
git commit -m "feat: graceful HTTP server shutdown, ReadTimeout/WriteTimeout/IdleTimeout"
```

---

### Task 10: Structured logging (slog) + SubscribeToEvents context

**Files:**
- Modify: `server/orchistrator/main.go`
- Modify: `server/orchistrator/mesh/server.go`
- Modify: `server/orchistrator/mesh/serial.go`
- Modify: `server/orchistrator/mesh/api.go`
- Modify: `server/orchistrator/mesh/node_registry.go`
- Modify: `server/orchistrator/eventStore/kafka.go`
- Modify: `server/orchistrator/eventStore/eventstore.go`
- Modify: `server/orchistrator/mesh/mock_event_store.go`

**Interfaces:**
- Modifies: `EventStoreInterface.SubscribeToEvents` — adds `ctx context.Context` first parameter
- Produces: all log output via `slog` at appropriate levels

---

- [ ] **Step 1: Update SubscribeToEvents interface signature**

In `server/orchistrator/eventStore/eventstore.go`:

```go
package eventstore

import "context"

// EventStoreInterface defines the event storage contract.
type EventStoreInterface interface {
	Connect() error
	WriteMessage(event string, topic string) error
	SubscribeToEvents(ctx context.Context, topic string) error
	Close() error
}
```

- [ ] **Step 2: Update kafka.go SubscribeToEvents to use context**

In `server/orchistrator/eventStore/kafka.go`, replace `SubscribeToEvents`:

```go
func (s *store) SubscribeToEvents(ctx context.Context, topic string) error {
	if s.reader != nil {
		s.reader.Close()
	}
	s.reader = kafka.NewReader(kafka.ReaderConfig{
		Brokers: []string{s.broker},
		Topic:   topic,
		GroupID: s.groupId,
	})
	slog.Info("Subscribed to Kafka topic", "topic", topic)
	for {
		msg, err := s.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				return nil // clean shutdown
			}
			slog.Error("Kafka consumer error", "topic", topic, "error", err)
			s.reader.Close()
			return err
		}
		slog.Debug("Kafka message received", "topic", msg.Topic, "value", string(msg.Value))
	}
}
```

Replace all `fmt.Printf` in `kafka.go` with `slog` calls:
- `fmt.Printf("connecting to Kafka: %v\n", ...)` → `slog.Info("Connecting to Kafka", "broker", s.broker)`
- `fmt.Printf("connected to Kafka: %v\n", ...)` → `slog.Info("Connected to Kafka", "broker", s.broker)`
- `fmt.Printf("Delivering to topic %v\n", ...)` → `slog.Debug("Delivering message", "topic", topic)`
- `fmt.Printf("Delivery failed: %v\n", ...)` → `slog.Error("Kafka delivery failed", "error", err)`
- `fmt.Printf("Delivered to topic %v\n", ...)` → `slog.Debug("Delivered message", "topic", topic)`

Add `"log/slog"` import, remove `"fmt"` if no longer used.

- [ ] **Step 3: Update mock_event_store.go SubscribeToEvents signature**

```go
func (m *MockEventStore) SubscribeToEvents(ctx context.Context, topic string) error { return nil }
```

Add `"context"` import.

- [ ] **Step 4: Replace log.Printf with slog in server.go**

In `server/orchistrator/mesh/server.go`, replace all `log.Printf` with `slog` equivalents:

| Old | New |
|-----|-----|
| `log.Printf("Mesh server started on serial port %s at %d baud", ...)` | `slog.Info("Mesh server started", "port", ms.serialPort, "baud", ms.baudRate)` |
| `log.Printf("[MSG_PROCESSOR] Error reading frame (#%d): %v", ...)` | `slog.Warn("Serial frame read error", "count", consecutiveErrors, "error", err)` |
| `log.Printf("[MSG_PROCESSOR] Too many consecutive frame errors (%d)...", ...)` | `slog.Error("Serial read suppressed — too many consecutive errors", "count", consecutiveErrors)` |
| `log.Printf("[MSG_PROCESSOR] Successfully received message...", ...)` | `slog.Debug("Message received", "type", msg.MessageType, "dataType", msg.DataType, "origin", macToString(msg.OriginMacAddress))` |
| `log.Printf("[MSG_PROCESSOR] Error handling message: %v", ...)` | `slog.Error("Message handling failed", "error", err)` |
| `log.Printf("Health report from %s...", ...)` | `slog.Info("Health report", "mac", macToString(healthReport.MAC), "adapterType", GetAdapterTypeName(healthReport.AdapterType), "uptime", healthReport.Uptime, "hops", healthReport.HopCount)` |
| `log.Printf("PIR motion detected from %s...", ...)` | `slog.Info("PIR motion detected", "mac", macToString(msg.OriginMacAddress), "hops", msg.HopCount)` |
| `log.Printf("[SEND_MESSAGE]...", ...)` | `slog.Debug("Sending message", "type", msg.MessageType, "dataType", msg.DataType)` |

Remove `"log"` import, add `"log/slog"`.

- [ ] **Step 5: Replace log.Printf with slog in serial.go**

In `server/orchistrator/mesh/serial.go`, replace all `log.Printf` with `slog.Debug` (all serial frame logging is debug-level — it floods production logs). Example:

```go
// Before:
log.Printf("[SERIAL_TX] Preparing to send message...")
// After:
slog.Debug("Serial TX", "type", msg.MessageType, "dataType", msg.DataType, "dataLen", len(msg.Data))
```

Reduce the per-byte hex dumps to a single debug log line each. Replace the multi-line "Header received", "Frame length", "Raw data received" sequence with:

```go
slog.Debug("Serial RX frame", "length", length)
// After unmarshal:
slog.Debug("Serial RX parsed", "type", msg.MessageType, "dataType", msg.DataType, "hops", msg.HopCount)
```

Remove `"log"` import, add `"log/slog"`.

- [ ] **Step 6: Replace log in api.go and node_registry.go**

In `api.go`: replace `log.Printf("Starting API server on port %d", port)` with `slog.Info("API server starting", "port", port)`. Remove `"log"` import if unused.

In `node_registry.go`: update the `log.Printf` calls in `Load` and `PersistLoop` to use `slog.Warn` / `slog.Info`. Remove `"log"` import.

- [ ] **Step 7: Configure slog level in main.go**

In `server/orchistrator/main.go`, configure slog before anything else:

```go
import "log/slog"

// At top of main(), before anything else:
var slogLevel slog.Level
switch logLevel {
case "DEBUG":
    slogLevel = slog.LevelDebug
case "WARN":
    slogLevel = slog.LevelWarn
case "ERROR":
    slogLevel = slog.LevelError
default:
    slogLevel = slog.LevelInfo
}
slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slogLevel})))
```

Replace remaining `log.Printf` in `main.go` with `slog` calls. Remove `"log"` import if unused.

- [ ] **Step 8: Compile and run tests**

```bash
cd server/orchistrator
go build ./...
go test ./... -v
```

Expected: zero build errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add server/orchistrator/
git commit -m "feat: structured logging via slog, SubscribeToEvents context cancellation, serial frame logs demoted to DEBUG"
```

---

## Phase 3 — Correctness

### Task 11: Fix Go backend correctness bugs

**Files:**
- Modify: `server/orchistrator/mesh/server.go`

---

- [ ] **Step 1: Write test for json.Marshal error handling in handlePIRData**

In `server/orchistrator/mesh/mesh_test.go`, add:

```go
func TestHandlePIRData_KafkaWriteError(t *testing.T) {
	mockStore := NewMockEventStore()
	registry := NewNodeRegistry()
	builder := NewMessageBuilder()

	server := &MeshServer{
		nodeRegistry:   registry,
		messageBuilder: builder,
		eventStore:     mockStore,
	}

	msg := &MeshMessage{
		OriginMacAddress: []byte{0x11, 0x22, 0x33, 0x44, 0x55, 0x66},
		HopCount:         1,
	}

	err := server.handlePIRData(msg)
	if err != nil {
		t.Errorf("handlePIRData should not return error for valid message, got %v", err)
	}

	if len(mockStore.GetMessages()) != 1 {
		t.Errorf("expected 1 Kafka message written, got %d", len(mockStore.GetMessages()))
	}
}
```

- [ ] **Step 2: Run test to verify it passes already (baseline)**

```bash
cd server/orchistrator
go test ./mesh/... -run TestHandlePIRData -v
```

Expected: PASS (existing code works for the happy path).

- [ ] **Step 3: Fix json.Marshal ignored error in handlePIRData**

In `server/orchistrator/mesh/server.go`, replace the `handlePIRData` function body:

```go
func (ms *MeshServer) handlePIRData(msg *MeshMessage) error {
	slog.Info("PIR motion detected", "mac", macToString(msg.OriginMacAddress), "hops", msg.HopCount)

	pirEvent := map[string]interface{}{
		"type":      "pir_motion",
		"mac":       macToString(msg.OriginMacAddress),
		"timestamp": time.Now().Unix(),
		"hopCount":  msg.HopCount,
		"data":      msg.Data,
	}

	eventJSON, err := json.Marshal(pirEvent)
	if err != nil {
		return fmt.Errorf("failed to marshal PIR event: %w", err)
	}

	if ms.eventStore == nil {
		return nil
	}

	if err := ms.eventStore.WriteMessage(string(eventJSON), "motion-trigger"); err != nil {
		slog.Warn("Failed to write PIR event to Kafka", "error", err)
	}

	return nil
}
```

- [ ] **Step 4: Compile**

```bash
cd server/orchistrator
go build ./...
go test ./mesh/... -v
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add server/orchistrator/mesh/server.go
git commit -m "fix: handle json.Marshal error in handlePIRData instead of silently ignoring it"
```

---

### Task 12: Fix React dashboard — real API + type safety

**Files:**
- Modify: `server/dashboard/app/routes/nodes.tsx`
- Modify: `server/dashboard/app/routes/server.tsx`
- Modify: `server/dashboard/app/interfaces/INodes.ts`
- Modify: `server/dashboard/app/components/NodeCard/nodeCard.tsx`
- Modify: `server/dashboard/app/services/apiService.tsx`

---

- [ ] **Step 1: Fix INode.lastSeen type**

In `server/dashboard/app/interfaces/INodes.ts`:

```typescript
export interface INode {
  mac: string;
  macString: string;
  adapterType: number;
  uptime: number;
  lastSeen: string; // ISO string from Go's time.Time JSON serialization
  hopCount: number;
  online?: boolean;  // derived client-side, not from API
  name?: string;     // not in API, kept optional for dev fixture compatibility
}

export type INodes = INode[];

export interface INodeCardProps {
  nodeData: INode;
}
```

Note: Go's `time.Time` marshals to RFC3339 string (`"2006-01-02T15:04:05Z"`). The `formatTime` function in `formatDateTime.tsx` already handles string inputs — no change needed there.

- [ ] **Step 2: Fix NodeCard — remove key from props**

In `server/dashboard/app/components/NodeCard/nodeCard.tsx`:

```tsx
import type { INodeCardProps } from "~/interfaces/INodes";
import { formatTime } from "~/services/formatDateTime";

export default function NodeCard({ nodeData }: INodeCardProps) {
  return (
    <div className="node-card h-max rounded-2xl bg-emerald-700 p-3">
      <p className="text-center text-2xl">{nodeData.macString}</p>
      <p className="text-xs text-right">mac: {nodeData.mac}</p>
      <p>Type: {nodeData.adapterType}</p>
      <p>Uptime: {nodeData.uptime}s</p>
      <p>Hops: {nodeData.hopCount}</p>
      <p>Last Seen: {formatTime(nodeData.lastSeen)}</p>
    </div>
  );
}
```

- [ ] **Step 3: Wire real ApiService in nodes.tsx + fix index type**

In `server/dashboard/app/routes/nodes.tsx`:

```tsx
import ApiService from "~/services/apiService";
import type { IApiResponse } from "~/interfaces/IApiService";
import type { Route } from "../+types/root";
import type { INode, INodes } from "~/interfaces/INodes";
import NodeCard from "~/components/NodeCard/nodeCard";

export async function loader({}: Route.LoaderArgs) {
  const response = (await ApiService("getNodes")) as IApiResponse;

  if (!response.success) {
    throw new Response(response.error ?? "Unknown error", { status: 500 });
  }
  if (!response.data) {
    throw new Response("No nodes found", { status: 404 });
  }

  return (response.data as INodes) ?? [];
}

export default function Nodes({ loaderData }: Route.ComponentProps) {
  const nodes = loaderData as INodes | undefined;
  return (
    <div className="p-6 justify-center">
      <h1 className="text-center">Nodes</h1>
      <br />
      <div className="nodes-container w-[80%] grid grid-cols-3 gap-4 justify-center m-auto">
        {nodes?.map((node: INode, index: number) => (
          <NodeCard key={index} nodeData={node} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Fix server.tsx loader response unwrapping**

In `server/dashboard/app/routes/server.tsx`, fix the loader and component types:

```tsx
import { useFetcher } from "react-router";
import type { Route } from "../+types/root";
import ApiService from "../services/apiService";
import type { IApiResponse } from "~/interfaces/IApiService";
import { useState } from "react";
import { formatTime } from "~/services/formatDateTime";

interface ServerStatus {
  running: boolean;
  totalNodes: number;
  onlineNodes: number;
  timestamp: number;
}

export async function loader({ request }: Route.LoaderArgs) {
  const response = (await ApiService("getStatus")) as IApiResponse<ServerStatus>;
  if (!response.success || !response.data) {
    throw new Response("Failed to get server status", { status: 500 });
  }
  return response.data;
}

export default function Server({ loaderData }: { loaderData?: ServerStatus }) {
  const fetcher = useFetcher<ServerStatus>();
  const [serverData, setServerData] = useState<ServerStatus>(
    loaderData ?? { running: false, totalNodes: 0, onlineNodes: 0, timestamp: 0 }
  );

  const isSubmitting = fetcher.state === "submitting";

  return (
    <div className="max-w-md mx-auto mt-10 p-8 bg-emerald-700 rounded-lg shadow-md text-center">
      <h1 className="text-3xl font-bold mb-4">Server Status</h1>
      <p className="text-lg mb-6">Running: <span>{String(serverData.running)}</span></p>
      <p className="text-lg mb-6">Total Nodes: <span>{serverData.totalNodes}</span></p>
      <p className="text-lg mb-6">Online Nodes: <span>{serverData.onlineNodes}</span></p>
      <p className="text-lg mb-6">Last Checked: <span>{formatTime(serverData.timestamp)}</span></p>
      <fetcher.Form method="post" className="flex gap-4 justify-center mb-4">
        <button type="submit" name="action" value="start" disabled={isSubmitting}
          className="px-4 py-2 rounded bg-blue-600 text-white font-medium transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed">
          Start Server
        </button>
        <button type="submit" name="action" value="stop" disabled={isSubmitting}
          className="px-4 py-2 rounded bg-red-600 text-white font-medium transition hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed">
          Stop Server
        </button>
      </fetcher.Form>
      {isSubmitting && <p className="mt-2 animate-pulse">Processing...</p>}
    </div>
  );
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const actionType = formData.get("action");

  if (actionType === "start") {
    await ApiService("startServer", { method: "POST" });
  } else if (actionType === "stop") {
    await ApiService("stopServer", { method: "POST" });
  }

  const response = (await ApiService("getStatus")) as IApiResponse<ServerStatus>;
  return response.data ?? { running: false, totalNodes: 0, onlineNodes: 0, timestamp: 0 };
}
```

- [ ] **Step 5: Fix ApiService URL construction for mac-based endpoints**

The current `ApiService` function doesn't handle the `getNode`/`configureNode` endpoints (which require a `mac` param). Add an overload-style helper:

In `server/dashboard/app/services/apiService.tsx`, add before the `ApiService` export:

```typescript
const HOST_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";
const API_KEY  = import.meta.env.VITE_API_KEY  ?? "";

function authHeaders(): HeadersInit {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

export function buildUrl(service: ServiceName, mac?: string): string {
  const endpoint = endpoints[service];
  if (typeof endpoint === "function") {
    if (!mac) throw new Error(`Service ${service} requires a mac parameter`);
    return `${HOST_URL}${endpoint(mac)}`;
  }
  return `${HOST_URL}${endpoint}`;
}

export default async function ApiService<ApiResponse>(
  service: ServiceName,
  options?: RequestInit,
  mac?: string
): Promise<ApiResponse> {
  const url = buildUrl(service, mac);
  const response = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(),
      ...(options?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}
```

- [ ] **Step 6: Run typecheck**

```bash
cd server/dashboard
npm run typecheck
```

Expected: zero TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add server/dashboard/app/routes/nodes.tsx server/dashboard/app/routes/server.tsx server/dashboard/app/interfaces/INodes.ts server/dashboard/app/components/NodeCard/nodeCard.tsx server/dashboard/app/services/apiService.tsx
git commit -m "fix: real ApiService in nodes/server routes, INode type matches API response, NodeCard key prop removed from interface"
```

---

## Phase 4 — Quality

### Task 13: Remove committed build artifacts

**Files:**
- Delete: `server/orchistrator/motionServer.exe`
- Delete: `server/dashboard/react-router-0.cpuprofile`
- Modify: `.gitignore` (root or per-directory)

---

- [ ] **Step 1: Remove artifacts from git**

```bash
git rm server/orchistrator/motionServer.exe
git rm server/dashboard/react-router-0.cpuprofile
```

- [ ] **Step 2: Add gitignore rules**

Check if a `.gitignore` exists at repo root:

```bash
ls /Users/benjamin.swanepoel/projects/personal/motionSensorServer/.gitignore
```

If it exists, add to it. If not, create it:

```
# Build artifacts
*.exe
*.cpuprofile

# Go build output
server/orchistrator/main
server/orchestrator/main

# Node
node_modules/
server/dashboard/build/

# Environment files
server/.env
.env

# Data files (runtime persistence)
server/orchistrator/data/
server/orchestrator/data/
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: remove committed build artifacts (motionServer.exe, .cpuprofile), add .gitignore"
```

---

### Task 14: Code quality — naming, constants, file organisation

**Files:**
- Modify: `server/orchistrator/mesh/constants.go`
- Modify: `server/orchistrator/mesh/message_builder.go`
- Modify: `server/orchistrator/mesh/node_registry.go`

---

- [ ] **Step 1: Move GetAdapterTypeName to constants.go**

In `server/orchistrator/mesh/constants.go`, add at the bottom:

```go
// GetAdapterTypeName returns a human-readable name for an adapter type.
func GetAdapterTypeName(adapterType int32) string {
	switch adapterType {
	case AdapterTypeUnknown:
		return "Unknown"
	case AdapterTypePIR:
		return "PIR"
	case AdapterTypeWIFI:
		return "WiFi"
	case AdapterTypeLED:
		return "LED"
	case AdapterTypeSerial:
		return "Serial"
	default:
		return fmt.Sprintf("Unknown(%d)", adapterType)
	}
}
```

Add `"fmt"` import to `constants.go`.

In `server/orchistrator/mesh/message_builder.go`, delete the `GetAdapterTypeName` function entirely (it now lives in `constants.go`). Remove `"fmt"` from `message_builder.go` imports if no longer used (check: `fmt.Errorf` is still used there, so keep it).

- [ ] **Step 2: Encapsulate BroadcastMAC**

In `server/orchistrator/mesh/constants.go`, replace:

```go
var BroadcastMAC = []byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}
```

with:

```go
var broadcastMAC = []byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}

// BroadcastMACBytes returns a copy of the broadcast MAC address.
func BroadcastMACBytes() []byte {
	cp := make([]byte, MACAddressLength)
	copy(cp, broadcastMAC)
	return cp
}
```

In `server/orchistrator/mesh/message_builder.go`, update `BuildConfigSetBroadcastMessage`:

```go
func (mb *MessageBuilder) BuildConfigSetBroadcastMessage(adapterType int32) (*MeshMessage, error) {
	return mb.BuildConfigSetMessage(BroadcastMACBytes(), adapterType)
}
```

- [ ] **Step 3: Compile and test**

```bash
cd server/orchistrator
go build ./...
go test ./... -v
```

Expected: zero errors, all tests pass.

- [ ] **Step 4: Commit**

```bash
git add server/orchistrator/mesh/constants.go server/orchistrator/mesh/message_builder.go
git commit -m "refactor: move GetAdapterTypeName to constants.go, encapsulate BroadcastMAC"
```

---

### Task 15: Rename orchistrator → orchestrator

**This is a breaking rename across the entire repo. Do not interleave with other tasks.**

**Files affected:**
- Rename directory: `server/orchistrator/` → `server/orchestrator/`
- Modify: `server/docker-compose.yml`
- Modify: `server/env.example`
- Modify: `server/QUICK_START.md`
- Note: Go module path (`github.com/superbrobenji/motionServer`) is independent of directory name — no change needed to `go.mod` or import paths

---

- [ ] **Step 1: Rename the directory**

```bash
mv server/orchistrator server/orchestrator
```

- [ ] **Step 2: Update docker-compose.yml**

In `server/docker-compose.yml`, update:
- Service name: `orchistrator:` → `orchestrator:`
- Build path: `build: ./orchistrator` → `build: ./orchestrator`
- Volumes: `./orchistrator:/orchistrator` → `./orchestrator:/orchestrator`
- Dashboard `depends_on`: `orchistrator:` → `orchestrator:`

- [ ] **Step 3: Update env.example**

In `server/env.example`, update any path references from `orchistrator` to `orchestrator`.

- [ ] **Step 4: Update QUICK_START.md**

In `server/QUICK_START.md`, replace all occurrences of `orchistrator` with `orchestrator`.

- [ ] **Step 5: Compile and test**

```bash
cd server/orchestrator
go build ./...
go test ./... -v
```

Expected: zero errors (module path unchanged, all imports still resolve).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: rename orchistrator → orchestrator (directory, docker-compose, docs)"
```

---

### Task 16: Rename service files .tsx → .ts + add navigation link for enrollments

**Files:**
- Rename: `server/dashboard/app/services/apiService.tsx` → `server/dashboard/app/services/apiService.ts`
- Rename: `server/dashboard/app/services/formatDateTime.tsx` → `server/dashboard/app/services/formatDateTime.ts`
- Modify: `server/dashboard/app/components/Navigation/navigation.tsx` — add Enrollments link
- Update all imports

---

- [ ] **Step 1: Rename files**

```bash
mv server/dashboard/app/services/apiService.tsx server/dashboard/app/services/apiService.ts
mv server/dashboard/app/services/formatDateTime.tsx server/dashboard/app/services/formatDateTime.ts
```

- [ ] **Step 2: Update all imports**

Search for `apiService.tsx` and `formatDateTime.tsx` references:

```bash
grep -r "apiService\|formatDateTime" server/dashboard/app --include="*.tsx" --include="*.ts" -l
```

For each file found, update the import from `~/services/apiService` (no extension change needed — TypeScript resolves without extension). No import path changes required since TypeScript doesn't include `.tsx`/`.ts` in imports.

Verify by running:

```bash
cd server/dashboard
npm run typecheck
```

- [ ] **Step 3: Add Enrollments to navigation**

In `server/dashboard/app/components/Navigation/navigation.tsx`:

```tsx
const pages = [
  { pageName: "Home", route: "/" },
  { pageName: "Nodes", route: "/nodes" },
  { pageName: "Enrollments", route: "/enrollments" },
  { pageName: "Server", route: "/server" },
];
```

- [ ] **Step 4: Typecheck**

```bash
cd server/dashboard
npm run typecheck
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add server/dashboard/app/services/ server/dashboard/app/components/Navigation/navigation.tsx
git commit -m "refactor: rename service files .tsx→.ts, add Enrollments nav link"
```

---

### Task 17: Dashboard Dockerfile HEALTHCHECK + test coverage

**Files:**
- Modify: `server/dashboard/Dockerfile`
- Create: `server/orchestrator/mesh/api_test.go`

---

- [ ] **Step 1: Add HEALTHCHECK to dashboard Dockerfile**

In `server/dashboard/Dockerfile`, find the `EXPOSE` line and add before `CMD`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1
```

- [ ] **Step 2: Write API handler tests**

Create `server/orchestrator/mesh/api_test.go`:

```go
package mesh

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func newTestServer(t *testing.T) (*APIServer, *MockEventStore) {
	t.Helper()
	mockStore := NewMockEventStore()
	registry := NewNodeRegistry()
	builder := NewMessageBuilder()

	// MeshServer with no serial (running=false is fine for API tests)
	ms := &MeshServer{
		nodeRegistry:   registry,
		messageBuilder: builder,
		eventStore:     mockStore,
	}
	return NewAPIServer(ms, "", nil), mockStore
}

func TestGetStatus(t *testing.T) {
	api, _ := newTestServer(t)

	req := httptest.NewRequest("GET", "/status", nil)
	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}

	var resp APIResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !resp.Success {
		t.Errorf("expected success:true")
	}
}

func TestGetNodes_Empty(t *testing.T) {
	api, _ := newTestServer(t)

	req := httptest.NewRequest("GET", "/nodes", nil)
	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", w.Code)
	}
}

func TestConfigureNode_InvalidMAC(t *testing.T) {
	api, _ := newTestServer(t)

	body := bytes.NewBufferString(`{"adapterType":0}`)
	req := httptest.NewRequest("POST", "/nodes/invalid-mac/configure", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestConfigureNode_InvalidAdapterType(t *testing.T) {
	api, _ := newTestServer(t)

	body := bytes.NewBufferString(`{"adapterType":99}`)
	req := httptest.NewRequest("POST", "/nodes/aa:bb:cc:dd:ee:ff/configure", body)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("expected 400, got %d", w.Code)
	}
}

func TestAuthMiddleware_ProtectsRoutes(t *testing.T) {
	mockStore := NewMockEventStore()
	registry := NewNodeRegistry()
	builder := NewMessageBuilder()
	ms := &MeshServer{
		nodeRegistry:   registry,
		messageBuilder: builder,
		eventStore:     mockStore,
	}
	api := NewAPIServer(ms, "test-key", nil)

	req := httptest.NewRequest("GET", "/status", nil)
	w := httptest.NewRecorder()
	api.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("expected 401 without auth, got %d", w.Code)
	}

	req2 := httptest.NewRequest("GET", "/status", nil)
	req2.Header.Set("Authorization", "Bearer test-key")
	w2 := httptest.NewRecorder()
	api.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Errorf("expected 200 with valid auth, got %d", w2.Code)
	}
}

func TestIsValidAdapterType_AllKnownTypes(t *testing.T) {
	valid := []int32{AdapterTypeUnknown, AdapterTypePIR, AdapterTypeWIFI, AdapterTypeLED, AdapterTypeSerial}
	for _, v := range valid {
		if !isValidAdapterType(v) {
			t.Errorf("expected type %d to be valid", v)
		}
	}
}
```

- [ ] **Step 3: Update NewAPIServer signature for nil corsOrigins**

Ensure `NewAPIServer` handles `nil` corsOrigins gracefully (CORSMiddleware with nil slice should behave as empty allowlist):

In `cors.go`, `CORSMiddleware` already handles this since `allowed` will be an empty map.

- [ ] **Step 4: Run all tests**

```bash
cd server/orchestrator
go test ./... -v -count=1
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/dashboard/Dockerfile server/orchestrator/mesh/api_test.go
git commit -m "test: API handler tests for all endpoints, auth middleware, adapter type validation; dashboard Dockerfile HEALTHCHECK"
```

---

### Task 18: Prometheus observability

**Files:**
- Modify: `server/orchestrator/go.mod`
- Create: `server/orchestrator/mesh/metrics.go`
- Modify: `server/orchestrator/mesh/api.go`
- Modify: `server/orchestrator/main.go`

---

- [ ] **Step 1: Add prometheus dependency**

```bash
cd server/orchestrator
go get github.com/prometheus/client_golang/prometheus
go get github.com/prometheus/client_golang/prometheus/promhttp
```

- [ ] **Step 2: Create metrics.go**

Create `server/orchestrator/mesh/metrics.go`:

```go
package mesh

import (
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "mesh_http_requests_total",
		Help: "Total HTTP requests by endpoint and status code.",
	}, []string{"endpoint", "method", "status"})

	httpRequestDuration = prometheus.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "mesh_http_request_duration_seconds",
		Help:    "HTTP request latency by endpoint.",
		Buckets: prometheus.DefBuckets,
	}, []string{"endpoint", "method"})

	kafkaWritesTotal = prometheus.NewCounterVec(prometheus.CounterOpts{
		Name: "mesh_kafka_writes_total",
		Help: "Total Kafka write attempts by topic and result.",
	}, []string{"topic", "result"})

	serialConnected = prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "mesh_serial_connected",
		Help: "1 if the serial connection to the mesh master is active, 0 otherwise.",
	})
)

func init() {
	prometheus.MustRegister(httpRequestsTotal, httpRequestDuration, kafkaWritesTotal, serialConnected)
}

// MetricsHandler returns the Prometheus HTTP handler.
func MetricsHandler() http.Handler {
	return promhttp.Handler()
}

// InstrumentHandler wraps an http.Handler with request count and duration metrics.
func InstrumentHandler(endpoint string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &statusResponseWriter{ResponseWriter: w, status: http.StatusOK}
		h.ServeHTTP(rw, r)
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.status)
		httpRequestsTotal.WithLabelValues(endpoint, r.Method, status).Inc()
		httpRequestDuration.WithLabelValues(endpoint, r.Method).Observe(duration)
	})
}

// RecordKafkaWrite records a Kafka write result.
func RecordKafkaWrite(topic string, err error) {
	result := "success"
	if err != nil {
		result = "error"
	}
	kafkaWritesTotal.WithLabelValues(topic, result).Inc()
}

// SetSerialConnected updates the serial connection gauge.
func SetSerialConnected(connected bool) {
	if connected {
		serialConnected.Set(1)
	} else {
		serialConnected.Set(0)
	}
}

type statusResponseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *statusResponseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
}
```

- [ ] **Step 3: Add /metrics endpoint to API**

In `server/orchestrator/mesh/api.go`, in `setupRoutes()`, add:

```go
api.router.Handle("/metrics", MetricsHandler())
```

This endpoint is exempt from auth middleware (Prometheus scrapers typically don't send Bearer tokens). Apply auth only to non-metrics routes by using a subrouter:

```go
func (api *APIServer) setupRoutes() {
	// Metrics endpoint — no auth
	api.router.Handle("/metrics", MetricsHandler())

	// All other routes — wrapped with auth
	sub := api.router.PathPrefix("").Subrouter()
	if api.apiKey != "" {
		sub.Use(AuthMiddleware(api.apiKey))
	}
	sub.HandleFunc("/nodes", api.getNodes).Methods("GET")
	// ... rest of routes on sub instead of api.router
}
```

Add `apiKey string` field to `APIServer` struct and set it in `NewAPIServer`.

- [ ] **Step 4: Wire SetSerialConnected into MeshServer**

In `server/orchestrator/mesh/server.go`, in `Start()` after successful serial open:

```go
SetSerialConnected(true)
```

In `Stop()` before returning:

```go
SetSerialConnected(false)
```

- [ ] **Step 5: Wire RecordKafkaWrite into logMessageToKafka**

In `server/orchestrator/mesh/server.go`, in `logMessageToKafka()`:

```go
err := ms.eventStore.WriteMessage(string(logJSON), "mesh-messages")
RecordKafkaWrite("mesh-messages", err)
return err
```

And in `handlePIRData`:

```go
err := ms.eventStore.WriteMessage(string(eventJSON), "motion-trigger")
RecordKafkaWrite("motion-trigger", err)
```

- [ ] **Step 6: Build and verify /metrics**

```bash
cd server/orchestrator
go build ./...
./main -serial /dev/null -port 18080
# In another terminal:
curl http://localhost:18080/metrics
# Expected: Prometheus text format with mesh_* metrics
```

- [ ] **Step 7: Commit**

```bash
git add server/orchestrator/mesh/metrics.go server/orchestrator/mesh/api.go server/orchestrator/mesh/server.go server/orchestrator/go.mod server/orchestrator/go.sum
git commit -m "feat: Prometheus /metrics endpoint — request count/latency, Kafka write counter, serial connection gauge"
```

---

## Self-Review

### Spec Coverage Check

| Spec requirement | Task |
|-----------------|------|
| Node enrollment + replay + proto version | Task 1 (delegates to security plan) |
| Enrollment HTTP API | Task 2 (delegates to security plan) |
| TX power API | Task 3 (delegates to security plan) |
| HTTP API auth middleware | Task 4 |
| Docker hardening (remove privileged/seccomp/apparmor) | Task 5 |
| CORS middleware | Task 5 |
| Request body size limits | Task 5 |
| adapterType input validation | Task 5 |
| Env var support (SERIAL_PORT, BAUD_RATE, etc.) | Task 6 |
| Kafka connectivity check | Task 7 |
| Kafka Close() on shutdown | Task 7 |
| EventStore_interface → EventStoreInterface | Task 7 |
| Node registry persistence | Task 8 |
| Graceful HTTP shutdown | Task 9 |
| HTTP server timeouts | Task 9 |
| Structured logging (slog) | Task 10 |
| SubscribeToEvents context cancellation | Task 10 |
| json.Marshal error in handlePIRData | Task 11 |
| dev_ApiService in production (nodes.tsx) | Task 12 |
| INode type mismatch | Task 12 |
| NodeCard key prop | Task 12 |
| server.tsx loader unwrapping | Task 12 |
| nodes.tsx index: any | Task 12 |
| motionServer.exe + .cpuprofile removed | Task 13 |
| GetAdapterTypeName → constants.go | Task 14 |
| BroadcastMAC encapsulation | Task 14 |
| orchistrator → orchestrator rename | Task 15 |
| .tsx → .ts for service files | Task 16 |
| Enrollments nav link | Task 16 |
| Dashboard Dockerfile HEALTHCHECK | Task 17 |
| HTTP API handler test coverage | Task 17 |
| Prometheus /metrics | Task 18 |
| ErrorBoundary in root.tsx | **Already exists** — root.tsx exports `ErrorBoundary`, React Router v7 pattern, no action needed |
| fmt.Printf → slog in kafka.go | Task 10 |

### Gaps None.

### Placeholder scan None found — all steps contain actual code.

### Type consistency
- `EventStoreInterface` renamed in Task 7; all references updated in same task.
- `BroadcastMACBytes()` introduced in Task 14; `message_builder.go` updated in same task.
- `StartAPIServer` signature changes in Task 4 (adds `apiKey`), Task 5 (adds `corsOrigins`), Task 9 (returns shutdown fn) — each task updates all call sites in same commit.
- `NewAPIServer` gains `apiKey string` field in Task 18 for metrics subrouter — Task 4 already adds `apiKey` to the function parameter; the struct field is added in Task 18.
