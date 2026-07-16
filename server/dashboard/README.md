<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Lattice Dashboard

React Router v7 web application for monitoring and controlling the Lattice
motion sensor mesh network. Communicates with the orchestrator REST API.

## Features

- Overview page with per-service health and node/pending-enrollment counts
- Node list with live status (online/offline, adapter type, uptime) and
  per-node detail
- Enrollment management — approve or reject pending nodes (admin tier)
- Server start/stop control
- Infrastructure — container management via the sidecar: per-container
  stats, logs, and restart
- Events feed — recent Kafka events streamed from the sidecar
- Cookie-based login protecting all pages
- Automatic polling of the orchestrator API

## Environment Variables

All variables are read server-side at runtime (loaders/actions run on the
Node server; nothing is baked into the client bundle).

| Variable | Description |
|----------|-------------|
| `ORCHESTRATOR_URL` | Orchestrator base URL (default `http://localhost:8080`) |
| `SIDECAR_URL` | Sidecar base URL for container/health/Kafka data (default `http://localhost:9000`) |
| `API_KEY` | Must match the orchestrator's `API_KEY`; used for standard orchestrator calls |
| `ADMIN_KEY` | Admin tier — enrollment approve/reject on the orchestrator and all sidecar calls. Also the login credential, so it must be set. May differ from `API_KEY` |

Copy `server/env.example` to `server/.env` and set the values before starting.

### Authentication

Logging in with the admin key sets a `lattice_session` HttpOnly cookie, which
every protected route validates against `ADMIN_KEY`
(`app/services/auth.server.ts`). Invalid or missing sessions redirect to
`/login`.

## Development

Prerequisites: Node.js LTS, npm.

```bash
cd server/dashboard
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` with hot module replacement.
Export `ORCHESTRATOR_URL`, `SIDECAR_URL`, `API_KEY`, and `ADMIN_KEY` (see
`server/env.example`) to connect to the orchestrator and sidecar, then log in
with the admin key.

### Type checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

## Production (Docker)

The dashboard is served as a containerised Node.js app. Run it via Docker
Compose from `server/`:

```bash
docker compose up -d dashboard
```

The service listens on port `3000` and connects to the orchestrator and
sidecar containers on the internal `kafka-net` Docker network via the
`ORCHESTRATOR_URL` and `SIDECAR_URL` environment variables.

### Manual Docker build

```bash
docker build -t lattice-dashboard server/dashboard/
docker run -p 3000:3000 \
  -e ORCHESTRATOR_URL=http://localhost:8080 \
  -e SIDECAR_URL=http://localhost:9000 \
  -e API_KEY=your-key \
  -e ADMIN_KEY=your-admin-key \
  lattice-dashboard
```

## Project Structure

```
app/
├── components/
│   ├── features/   # ContainerRow, LogViewer, NodeCard, ServiceCard
│   ├── layout/     # AppLayout, PageHeader, Sidebar
│   └── ui/         # Badge, DataTable, StatBar, StatusDot
├── hooks/          # useContainerStats, usePolling
├── routes/         # _auth.* — protected pages behind the _auth layout:
│                   # overview (_auth._index), nodes (+ $id detail),
│                   # enrollments, events, infrastructure (+ $name detail
│                   # and restart), server-controls, api.logs/api.stats
│                   # resource routes; plus login and logout
├── services/
│   ├── auth.server.ts          # lattice_session cookie auth against ADMIN_KEY
│   ├── orchestrator.server.ts  # Orchestrator API client (API_KEY / ADMIN_KEY)
│   └── sidecar.server.ts       # Sidecar client — containers, health, Kafka
├── types/          # containers, health, kafka, nodes
└── utils/          # formatDateTime
```

## License

Copyright (C) 2026 Lattice Contributors.
GNU General Public License v3.0 — see root [LICENSE](../../LICENSE).
