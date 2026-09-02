<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Lattice Motion Sensor Server

[![CI](https://github.com/superbrobenji/lattice-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/superbrobenji/lattice-hub/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Go 1.25+ (orchestrator), 1.26+ (sidecar)](https://img.shields.io/badge/Go-1.25%2B%20%28orchestrator%29%2C%201.26%2B%20%28sidecar%29-00ADD8.svg)](https://go.dev/)

Server-side counterpart to the [Lattice ESP32 firmware](https://github.com/superbrobenji/lattice-nodes). Receives motion events from an ESP32-NOW mesh network over USB serial, stores them in Kafka, and exposes a REST API and web dashboard for monitoring and control.

## Architecture

```
┌──────────────────┐    USB Serial    ┌─────────────────┐    ESP-NOW Mesh    ┌─────────────────┐
│   Orchestrator   │ ◄──────────────► │  ESP32 Master   │ ◄─────────────────► │   Mesh Nodes    │
│   (Go service)   │    115200 baud   │                 │                     │   (PIR, LED)    │
└──────────────────┘                  └─────────────────┘                     └─────────────────┘
        │
        ├──► Kafka (motion-trigger, mesh-messages topics)
        │
        └──► HTTP API :8080
                │
                ├──► Dashboard (React Router :3000) — admin web UI
                │
                └──► Artist Portal (React Router :3001) — artist workspace UI
```

## Ecosystem

`lattice-hub` is the server-side counterpart to the [`lattice-nodes`](https://github.com/superbrobenji/lattice-nodes) ESP32 firmware, which runs on the PIR/LED mesh nodes and the serial-attached ESP32 master. The two sides communicate over USB serial using a wire format — message types, opcodes, and adapter definitions — defined by [`lattice-protocol`](https://github.com/superbrobenji/lattice-protocol), a direct Go dependency of `server/orchestrator` currently pinned to `v0.6.0` (see `server/orchestrator/go.mod`). Because both ends decode the same wire format, `lattice-hub` and `lattice-nodes` are tightly version-coupled: bumping `lattice-protocol` on the server is a flag day for the firmware, since `mesh/server.go` drops any message whose `ProtoVersion` doesn't match the value this build expects (currently `5`) — a mismatch is logged as a warning, but the node itself gets no reply and simply goes dark. Reflash `lattice-nodes` with a compatible protocol version whenever `lattice-protocol` bumps to a new incompatible version on the server.

## Repository Structure

```
lattice-hub/
├── server/
│   ├── orchestrator/    # Go service — serial comms, mesh protocol, REST API, Kafka
│   ├── dashboard/       # React Router app — admin web UI for node monitoring
│   ├── artist-portal/   # React Router app — artist workspace UI
│   ├── sidecar/         # Go service — container health, logs, and Kafka monitoring (see server/sidecar/README.md)
│   ├── logging/         # Jupyter notebooks for motion event analysis
│   ├── stub-data/       # Seed data for the hardware-free stub stack
│   ├── docker-compose.yml
│   ├── docker-compose.dev.yml        # Dev-only extras (Jupyter)
│   ├── docker-compose.stub.yml       # Hardware-free stack with mesh-sim
│   ├── docker-compose.stub.seed.yml  # Stub stack pre-seeded from stub-data/
│   └── env.example
├── e2e/                 # Playwright end-to-end suite (runs against the stub stack)
└── docs/                # Guides: setup, hub usage, API walkthrough, ecosystem, wire protocol
```

`server/sidecar/` has its own [README.md](server/sidecar/README.md). `docs/` now holds the
getting-started, hub-usage, API, ecosystem, wire-protocol, and build/hosting guides — see
[Documentation](#documentation) below for the full list.

## Quick Start

Prerequisites: Docker and Docker Compose.

```bash
# 1. Configure environment
cp server/env.example server/.env
# Edit server/.env — set both API_KEY and ADMIN_KEY (generate: openssl rand -hex 32).
# Compose refuses to start without both.

# 2. Start all services
docker compose -f server/docker-compose.yml up -d

# 3. Verify
curl http://localhost:8080/api/v1/status
```

Expected response (no nodes enrolled yet):
```json
{"success":true,"data":{"serial":{"primary":"connected","secondary":"not_configured"},"nodes":{"total":0,"online":0,"offline":0,"nextFreeId":1},"mesh":{"masterOnline":true,"primaryOnline":true,"secondaryOnline":false}}}
```

See [server/QUICK_START.md](server/QUICK_START.md) for USB serial device setup, Proxmox passthrough, and troubleshooting.

**On macOS**, Docker Desktop can't pass a host USB-serial device into the `orchestrator`
container at all, so bringing up a real ESP32 master needs a different path — running the
orchestrator natively while the rest of the stack stays in Docker (`make native`). See
[docs/macos_native_dev.md](docs/macos_native_dev.md).

## End-to-end tests

The `e2e/` directory holds a Playwright suite that exercises the dashboard and artist-portal against a stub stack — no ESP32 hardware required. A `mesh-sim` service stands in for the serial-attached ESP32 master, speaking the same protocol over `tcp://` instead of USB: it emits heartbeats and route reports, acks commands, and drives node enrollment and motion events like a real mesh.

Run the full suite, which builds and boots the stub stack (via `make stub-seed`) before running the tests:

```bash
make e2e
```

To iterate on tests against a stack that's already running:

```bash
make stub-seed
cd e2e && npx playwright test
```

`mesh-sim`'s control API listens on `localhost:9001` for deterministic test orchestration — poke it directly to trigger simulated events by hand:

```bash
curl -X POST localhost:9001/sim/nodes/aa:bb:cc:dd:ee:01/motion
```

Both the dashboard and artist-portal are covered.

## Documentation

| Document | Contents |
|----------|----------|
| [server/orchestrator/README.md](server/orchestrator/README.md) | Protocol spec, API reference, configuration, Docker deployment |
| [server/dashboard/README.md](server/dashboard/README.md) | Dashboard setup, environment variables, development workflow |
| [server/artist-portal/README.md](server/artist-portal/README.md) | Artist Portal setup, environment variables, development workflow |
| [server/QUICK_START.md](server/QUICK_START.md) | Docker setup, USB device passthrough, troubleshooting |
| [docs/getting_started.md](docs/getting_started.md) | Non-technical, zero-to-running walkthrough — Docker install through first node enrollment |
| [docs/macos_native_dev.md](docs/macos_native_dev.md) | Running the orchestrator natively on macOS against a real ESP32 master — Docker Desktop can't pass through USB-serial devices |
| [docs/using_the_hub.md](docs/using_the_hub.md) | Plain-language guide to the Dashboard and Artist Portal web UIs |
| [docs/api_guide.md](docs/api_guide.md) | Plain-language walkthrough of the public REST API, for non-technical readers |
| [docs/ecosystem.md](docs/ecosystem.md) | How `lattice-hub`, `lattice-nodes`, and `lattice-protocol` relate, and the protocol-version flag-day |
| [docs/wire_protocol.md](docs/wire_protocol.md) | Deep dive on the hub-side wire protocol — `ProtoVersion` enforcement, enrollment handshake, JOIN_ACK layout |
| [docs/building_and_hosting_a_release.md](docs/building_and_hosting_a_release.md) | Proposed versioning/build/hosting conventions — generic self-hosted server and Raspberry Pi |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, code standards, CI pipeline |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |

## Services

| Service | Port | Description |
|---------|------|-------------|
| Orchestrator API | 8080 | REST API for node management and server control |
| Dashboard | 3000 | Admin web UI |
| Artist Portal | 3001 | Artist workspace UI |
| Sidecar | 9000 | Container health, logs, and Kafka monitoring |
| Kafka | 9092 | Event stream (internal) |
| Jupyter | 8888 | Notebook environment for data analysis (dev only — `docker-compose.dev.yml`) |

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).
Copyright (C) 2026 Lattice Contributors.
