<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Lattice Sidecar

Go service that gives the dashboard operational visibility into the rest of
the `server/` Docker Compose stack: container list/restart/logs/stats/inspect
via the Docker Engine API, Kafka reachability and recent event tailing, and
an aggregate health probe across the other services. Listens on port `9000`.
It does not talk to the mesh or the orchestrator's serial link — it only
reads the local Docker socket and the Kafka broker.

## Features

- **Containers** — list (filtered to the current Compose project), restart,
  tail logs, live CPU/memory stats, and full inspect (ports, mounts, env vars
  with secret-looking values redacted) for any container, via
  `github.com/moby/moby/client` against the Docker Engine API
- **Kafka** — broker reachability/partition count for `motion-trigger`, and a
  tail of the `n` most recent messages on that topic
- **Aggregate health** — concurrently probes Docker state/health plus an HTTP
  check for the orchestrator, dashboard, and artist-portal containers, and a
  Kafka broker check, all in one response
- Every route requires the same admin bearer token — there is no public tier
  (see [Authentication](#authentication))

## Environment Variables

| Variable | Default | Description |
|----------|---------|--------------|
| `ADMIN_KEY` | *(required)* | Bearer token required on every request, including `/sidecar/services/health`. Unlike the orchestrator and dashboard, there is no fallback: `main.go` calls `log.Fatal("ADMIN_KEY is required")` at startup if it's unset — the process will not start. |
| `KAFKA_BROKER` | `kafka:9092` | Kafka broker address used by the Kafka status/recent-events endpoints and the Kafka leg of the health probe |
| `COMPOSE_PROJECT` | `server` | Docker Compose project label value (`com.docker.compose.project=<value>`) used to filter which containers `GET /sidecar/containers` returns |

Docker connectivity itself is not configured via an app-specific variable —
the client is built with `client.FromEnv` (standard `DOCKER_HOST` etc.), and
in the default Compose deployment it talks to the host daemon over
`/var/run/docker.sock`, mounted read-only (see [Production](#production-docker)).

## Authentication

There is a single tier: every route is wrapped, at the router level, by
`handlers.AuthMiddleware(adminKey)` — a plain bearer-token check with no
exceptions for reads or for the health endpoint itself. A request with a
missing or incorrect `Authorization: Bearer <ADMIN_KEY>` header gets
`401 {"error":"unauthorized"}`. This differs from the orchestrator, which has
public/API-key/admin tiers — the sidecar has only the equivalent of an admin
tier, and it applies to everything.

CORS is also handled globally (`corsMiddleware` in `main.go`): every response
gets `Access-Control-Allow-Origin: *` (a fixed wildcard, not the
allowlist-driven `ALLOWED_ORIGINS` the orchestrator uses), plus
`Access-Control-Allow-Methods: GET, POST, OPTIONS` and
`Access-Control-Allow-Headers: Authorization, Content-Type`; `OPTIONS`
requests short-circuit with a bare `204`.

## HTTP API

All paths are rooted at `/sidecar`. Source: `server/sidecar/main.go` (route
registration) and `server/sidecar/handlers/` (implementations).

| Method | Path | Description |
|--------|------|--------------|
| `GET` | `/sidecar/containers` | List containers in the current Compose project (id, names, image, status, state) |
| `POST` | `/sidecar/containers/{name}/restart` | Restart a container (10s stop timeout) |
| `GET` | `/sidecar/containers/{name}/logs` | Tail container logs as `text/plain`. Query param `tail` (default `100`; any value outside `1`–`1000`, or non-numeric, falls back to `100`) |
| `GET` | `/sidecar/containers/{name}/stats` | One-shot CPU %, memory used (cache-adjusted), and memory limit |
| `GET` | `/sidecar/containers/{name}/inspect` | Full inspect: id, name, image, created, Docker state/health, restart policy, ports, mounts, and env vars (values redacted to `[redacted]` when the key contains `KEY`, `SECRET`, `TOKEN`, `PASSWORD`, `PASS`, or `PWD`, case-insensitive) |
| `GET` | `/sidecar/kafka/status` | Broker reachability and partition count for the `motion-trigger` topic |
| `GET` | `/sidecar/kafka/events/recent` | Most recent messages on `motion-trigger`. Query param `n` (default `50`, max `500`; invalid or out-of-range values fall back to `50`) |
| `GET` | `/sidecar/services/health` | Aggregate health: Docker state/health plus an HTTP probe for `orchestrator`, `dashboard`, and `artist-portal`, a TCP/partition probe for `kafka`, and a self entry for `sidecar` with no external probe |

All routes require `Authorization: Bearer $ADMIN_KEY` (see
[Authentication](#authentication)).

Notes on individual endpoints:

- `GetLogs`/`GetStats`/`InspectContainer`/`RestartContainer` take the
  container **name** (as Docker knows it, e.g. `orchestrator`) from the
  `{name}` path segment — not a Compose service alias distinct from the
  container name.
- On a Docker error, endpoints generally respond `503
  {"error":"docker unavailable"}` (or `500`/`404` for stats-decode and
  not-found cases respectively) rather than propagating raw Docker client
  errors.
- `/sidecar/services/health`'s HTTP probes target the other services by
  their Compose service DNS name on the `kafka-net` Docker network (e.g.
  `http://orchestrator:8080/health`), so those probes only resolve when this
  service is actually running inside the Compose stack — running the sidecar
  standalone outside Compose will report those legs as unreachable even if
  the target services are up elsewhere.

## Example Requests

```bash
# List containers in the "server" Compose project
curl -H "Authorization: Bearer $ADMIN_KEY" http://localhost:9000/sidecar/containers

# Restart the orchestrator container
curl -X POST -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:9000/sidecar/containers/orchestrator/restart

# Tail the last 200 log lines from the dashboard container
curl -H "Authorization: Bearer $ADMIN_KEY" \
  "http://localhost:9000/sidecar/containers/dashboard/logs?tail=200"

# Live CPU/memory stats for the orchestrator container
curl -H "Authorization: Bearer $ADMIN_KEY" \
  http://localhost:9000/sidecar/containers/orchestrator/stats

# Kafka broker reachability
curl -H "Authorization: Bearer $ADMIN_KEY" http://localhost:9000/sidecar/kafka/status

# Last 20 motion-trigger events
curl -H "Authorization: Bearer $ADMIN_KEY" \
  "http://localhost:9000/sidecar/kafka/events/recent?n=20"

# Aggregate health across all services
curl -H "Authorization: Bearer $ADMIN_KEY" http://localhost:9000/sidecar/services/health
```

## Development

Prerequisites: Go 1.26+, and access to a Docker daemon socket (for the
container endpoints — everything else works without it, modulo Docker-state
fields in the health probe coming back `unknown`).

```bash
cd server/sidecar
ADMIN_KEY=dev-key go run .
```

### Tests

```bash
go test ./...
go vet ./...
```

`handlers/*_test.go` covers `AuthMiddleware` (accept/reject on bearer token)
and `IsSecretEnvKey` (redaction keyword matching) directly; the Docker- and
Kafka-backed handlers are exercised at the JSON-shape level since they
require a live Docker/Kafka connection for full integration coverage. See
`CONTRIBUTING.md` for the repo-wide `sidecar-test`/`sidecar-lint` CI jobs.

## Production (Docker)

Run via Docker Compose from `server/`:

```bash
docker compose up -d sidecar
```

Per `server/docker-compose.yml`, the container:

- listens on `9000:9000`
- mounts `/var/run/docker.sock:ro` (read-only) to talk to the host's Docker
  daemon
- runs with `security_opt: no-new-privileges:true` and as a non-root
  `appuser` (see `Dockerfile`)
- requires `ADMIN_KEY` to be set in the environment — Compose fails fast
  (`ADMIN_KEY=${ADMIN_KEY:?ADMIN_KEY is required}`) if it isn't
- joins the internal `kafka-net` network, where it reaches `kafka:9092` and
  the other services by their Compose service name

### Manual Docker build

```bash
docker build -t lattice-sidecar server/sidecar/
docker run -p 9000:9000 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  -e ADMIN_KEY=your-admin-key \
  -e KAFKA_BROKER=kafka:9092 \
  lattice-sidecar
```

## Project Structure

```
main.go            # Entrypoint: router setup, auth/CORS middleware, :9000 listener
handlers/
├── auth.go        # AuthMiddleware (bearer-token check) + WriteJSON helper
├── containers.go  # Container list/restart/logs/stats/inspect (+ IsSecretEnvKey redaction)
├── kafka.go       # Kafka status + recent-events handlers
└── health.go      # Aggregate /sidecar/services/health probe
```

## License

Copyright (C) 2026 Lattice Contributors.
GNU General Public License v3.0 — see root [LICENSE](../../LICENSE).
