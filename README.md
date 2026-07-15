<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Lattice Motion Sensor Server

[![CI](https://github.com/superbrobenji/lattice-hub/actions/workflows/ci.yml/badge.svg)](https://github.com/superbrobenji/lattice-hub/actions/workflows/ci.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Go 1.23+](https://img.shields.io/badge/Go-1.23+-00ADD8.svg)](https://go.dev/)

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
                └──► Dashboard (React Router :3000)
```

## Repository Structure

```
lattice-hub/
├── server/
│   ├── orchestrator/    # Go service — serial comms, mesh protocol, REST API, Kafka
│   ├── dashboard/       # React Router app — web UI for node monitoring
│   ├── logging/         # Jupyter notebooks for motion event analysis
│   ├── docker-compose.yml
│   └── env.example
└── docs/
```

## Quick Start

Prerequisites: Docker and Docker Compose.

```bash
# 1. Configure environment
cp server/env.example server/.env
# Edit server/.env — at minimum set API_KEY (generate: openssl rand -hex 32)

# 2. Start all services
docker compose -f server/docker-compose.yml up -d

# 3. Verify
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/status
```

Expected response:
```json
{"success":true,"data":{"running":false,"totalNodes":0,"onlineNodes":0,"timestamp":1704067200}}
```

See [server/QUICK_START.md](server/QUICK_START.md) for USB serial device setup, Proxmox passthrough, and troubleshooting.

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
| [server/QUICK_START.md](server/QUICK_START.md) | Docker setup, USB device passthrough, troubleshooting |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow, code standards, CI pipeline |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |

## Services

| Service | Port | Description |
|---------|------|-------------|
| Orchestrator API | 8080 | REST API for node management and server control |
| Dashboard | 3000 | Web UI |
| Kafka | 9092 | Event stream (internal) |
| Jupyter | 8888 | Notebook environment for data analysis |

## License

GNU General Public License v3.0 — see [LICENSE](LICENSE).
Copyright (C) 2026 Lattice Contributors.
