# Full Codebase Review — Design Spec

**Date:** 2026-06-25
**Scope:** Go orchestrator, React dashboard, Docker infrastructure
**Breaking changes:** Allowed (not in production)
**Related plan:** `docs/superpowers/plans/2026-06-25-security-and-auth-support.md` (folded into Phase 1)

---

## Goal

Bring the motionSensorServer codebase to industry-standard quality across security, infrastructure, correctness, and code quality. Four full-stack phases, each shipping a deployable state. Phase 1 unblocks the Planetopia node firmware security work.

---

## Architecture

Three layers touched in every phase:
- **Go orchestrator** (`server/orchestrator/`) — mesh server, event store, HTTP API
- **React dashboard** (`server/dashboard/`) — React Router v7 frontend
- **Docker infrastructure** (`server/docker-compose.yml`, Dockerfiles)

---

## Phase 1 — Security

### 1.1 Node enrollment + replay protection (existing plan, incorporated)

Fold in `docs/superpowers/plans/2026-06-25-security-and-auth-support.md` as-is:
- `mesh.proto` extended with `protoVersion`, `epochNum`, `seqNum`, enrollment message types
- `nodeauth` package: trusted node registry, JSON persistence, replay cache
- `MeshServer` wired with enrollment handling (OP_ENROLLMENT_REQ/APPROVE/REJECT)
- HTTP API: `GET /api/enrollments/pending`, `POST /api/enrollments/{mac}/approve`, `POST /api/enrollments/{mac}/reject`
- Dashboard: enrollment approval page

This is a hard prerequisite for the Planetopia node firmware security implementation.

### 1.2 HTTP API authentication

Add API key middleware to the Go HTTP API. All endpoints require `Authorization: Bearer <key>` header. Key configured via `API_KEY` env var at startup. Requests without a valid key receive `401 Unauthorized`.

- Middleware applied globally in `setupRoutes()`
- Key loaded from env on startup; server refuses to start if `API_KEY` is empty
- Dashboard passes key via env var `VITE_API_KEY` injected at build/runtime

### 1.3 Docker hardening

The orchestrator container currently runs with maximum privilege. Reduce attack surface:
- Remove `privileged: true`
- Remove `security_opt: seccomp:unconfined` and `apparmor:unconfined`
- Remove `cap_add: SYS_ADMIN`
- Replace `/dev:/dev` full mount with specific device bind (`/dev/ttyUSB0` only — already in `devices:` section)
- Remove `/sys:/sys` mount
- Remove `user: "0:0"` — run as non-root
- Keep `group_add: "20"` (dialout GID) so the non-root `appuser` can access the serial device

### 1.4 CORS

Add CORS middleware to the Go API server. Allowed origins configured via `CORS_ORIGINS` env var (comma-separated). Default: `http://localhost:3000` for development. Rejects cross-origin requests from unlisted origins.

### 1.5 Request body size limits

Wrap all HTTP handlers with `http.MaxBytesReader` limiting request bodies to 64KB. Prevents OOM via crafted large payloads.

### 1.6 Input validation — adapterType

`ConfigureNode` and `ConfigureAllNodes` endpoints validate `adapterType` is one of the known enum values (`-1`, `0`, `1`, `2`, `3`). Unknown values return `400 Bad Request`.

---

## Phase 2 — Infrastructure

### 2.1 Node state persistence

`NodeRegistry` persists to a JSON file on disk (same pattern as `nodeauth` persistence). Loaded on startup, saved on graceful shutdown and periodically (every 60s). Path configured via `NODE_REGISTRY_PATH` env var, default `data/nodes.json`. Survives server restarts.

### 2.2 Graceful HTTP server shutdown

Replace bare `http.ListenAndServe` with `http.Server` struct. On SIGINT/SIGTERM, call `server.Shutdown(ctx)` with a 10-second timeout before exiting. HTTP server shutdown wired into the same signal handler as `meshServer.Stop()`.

### 2.3 HTTP server timeouts

`http.Server` configured with:
- `ReadTimeout: 15s`
- `WriteTimeout: 15s`
- `IdleTimeout: 60s`

### 2.4 Kafka connectivity verification

`Connect()` in `kafka.go` performs a real connectivity check: attempt to list topics (or send a test message and verify no error) before returning nil. The retry loop in `main.go` then correctly detects Kafka unavailability.

### 2.5 Kafka writer close on shutdown

`EventStore_interface` gains a `Close() error` method. `store.writer.Close()` called during graceful shutdown. `main.go` defers `eventStore.Close()` after stopping the mesh server.

### 2.6 Structured logging

Replace `log.Printf` with Go 1.21 `slog` (stdlib, zero new dependencies). Log levels: `DEBUG` for serial frame bytes, `INFO` for state changes, `WARN` for recoverable errors, `ERROR` for failures. Log level configured via `LOG_LEVEL` env var, default `INFO`. `fmt.Printf` in `kafka.go` replaced with `slog`.

### 2.7 SubscribeToEvents context cancellation

`SubscribeToEvents(ctx context.Context, topic string) error` — add context parameter. Loop exits when `ctx` is cancelled. Existing callers (none currently) updated. Interface updated accordingly.

### 2.8 Env var support in main.go

`main.go` reads env vars before applying flag defaults. Priority: CLI flag > env var > hardcoded default. Env vars: `SERIAL_PORT`, `BAUD_RATE`, `API_PORT`, `KAFKA_BROKER`, `API_KEY`, `LOG_LEVEL`, `NODE_REGISTRY_PATH`, `CORS_ORIGINS`.

---

## Phase 3 — Correctness

### 3.1 Remove dev_ApiService from production paths

`nodes.tsx` loader uses `dev_ApiService` — replace with real `ApiService`. `dev_ApiService` remains in the file but is never called in non-test code. Add a comment marking it test-only.

### 3.2 Fix INode.lastSeen type

`INode.lastSeen` changed from `string` to `number` (unix timestamp). `formatTime` in `formatDateTime.ts` updated to accept `number`. `NodeCard` component updated. Dev fixture data already uses `number` — no change needed there.

### 3.3 Fix NodeCard key prop

Remove `key` from `INodeCardProps` interface. Remove `key` from `NodeCard` function parameters. `key={index}` stays on the JSX element in the parent — React handles it there, not inside the component.

### 3.4 Fix server.tsx loader response unwrapping

`loader` in `server.tsx` calls `ApiService<{ status: string }>("getStatus")` but API returns `IApiResponse`. Fix generic type and unwrap `response.data` before returning from loader so component receives the flat status object.

### 3.5 Fix json.Marshal ignored error

In `handlePIRData`, replace `eventJSON, _ := json.Marshal(pirEvent)` with proper error check. On marshal failure, log the error and return early rather than writing an empty/corrupt message to Kafka.

### 3.6 Fix nodes.tsx index type

`.map((node: INode, index: any)` → `.map((node: INode, index: number)`.

---

## Phase 4 — Quality

### 4.1 Rename orchestrator → orchestrator

Rename directory `server/orchestrator/` to `server/orchestrator/`. Update:
- `docker-compose.yml` service name and build path
- All Dockerfiles
- `go.mod` module path
- All Go import paths
- `env.example`
- `QUICK_START.md`
- Any other references

### 4.2 EventStore interface naming

`EventStore_interface` → `EventStoreInterface`. Update all references.

### 4.3 Move GetAdapterTypeName to constants.go

Remove from `message_builder.go`, add to `constants.go`. No behaviour change.

### 4.4 BroadcastMAC encapsulation

`var BroadcastMAC = []byte{...}` → unexported `broadcastMAC` with a `BroadcastMACBytes() []byte` accessor that returns a copy. Prevents accidental mutation.

### 4.5 Rename service files

`apiService.tsx` → `apiService.ts`
`formatDateTime.tsx` → `formatDateTime.ts`
Update all imports.

### 4.6 Remove committed artifacts

`server/orchestrator/motionServer.exe` — remove from git, add `*.exe` to `.gitignore`
`server/dashboard/react-router-0.cpuprofile` — remove from git, add `*.cpuprofile` to `.gitignore`

### 4.7 Dashboard Dockerfile HEALTHCHECK

Add to `server/dashboard/Dockerfile`:
```
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1
```

### 4.8 Test coverage

New tests:
- HTTP API handlers (`api_test.go`) — all endpoints, auth middleware, input validation
- Kafka error paths — `Connect()` failure, `WriteMessage()` failure, `Close()`
- Env var parsing in `main.go`
- `mock_event_store.go` wired into `MeshServer` integration tests (currently defined but unused)

### 4.9 React ErrorBoundary

Add `ErrorBoundary` component wrapping the root outlet in `root.tsx`. Catches render errors, displays a fallback UI instead of blank screen.

### 4.10 Observability stub

Add Prometheus `/metrics` endpoint to the Go API server using `prometheus/client_golang`. Instrument:
- Request count per endpoint
- Request latency histogram
- Active serial connection gauge
- Kafka write success/failure counter

`METRICS_ENABLED` env var gates this (default `true`).

---

## Data Flow (unchanged)

```
ESP32 mesh → serial → MeshServer → NodeRegistry (persisted)
                                 → Kafka (mesh-messages, motion-trigger, mesh-enrollment)
                                 → HTTP API → Dashboard
```

---

## Files Modified Per Phase

| Phase | Go files | React files | Docker files |
|-------|----------|-------------|--------------|
| 1 | mesh/server.go, mesh/api.go, mesh/serial.go, mesh/mesh.proto, mesh/mesh.pb.go, nodeauth/* (new) | routes/enrollments.tsx (new), services/apiService.tsx, routes/nodes.tsx, routes/server.tsx | docker-compose.yml |
| 2 | main.go, mesh/server.go, mesh/api.go, eventStore/kafka.go, eventStore/eventstore.go, mesh/node_registry.go | services/apiService.tsx | — |
| 3 | mesh/server.go | routes/nodes.tsx, routes/server.tsx, interfaces/INodes.ts, services/formatDateTime.tsx, components/NodeCard/nodeCard.tsx | — |
| 4 | All (rename), mesh/constants.go, mesh/message_builder.go, mesh/*_test.go | services/apiService.tsx→.ts, services/formatDateTime.tsx→.ts, root.tsx | Dockerfiles, docker-compose.yml |

---

## Success Criteria

- Phase 1: Node firmware security plan can be implemented against this server. All API endpoints require auth. Docker container no longer runs with `privileged: true`.
- Phase 2: Server restart does not lose node state. `docker-compose down && docker-compose up` reconnects cleanly with all known nodes restored. Kafka shutdown is clean (no lost messages).
- Phase 3: Dashboard nodes page displays real data. No type errors in TypeScript strict mode.
- Phase 4: `go test ./...` passes with >80% coverage on API handlers. `npm run build` produces zero TypeScript errors. No artifacts in git.
