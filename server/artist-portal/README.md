<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Lattice Artist Portal

Public-facing React Router v7 (SSR) web application for artists working with
the Lattice motion sensor mesh network. Talks to the orchestrator REST API
server-side and subscribes to its SSE event stream in the browser. Served on
port `3001` in production.

## Features

- **Live Tracker** — node list and mesh map views with a live connection
  banner, updated in real time via the orchestrator SSE stream
  (`motion`, `health`, `node_online`, `node_offline`, `enrolled`,
  `command_ack`, `route_update`)
- **Mesh map** — React Flow (`@xyflow/react`) topology laid out with dagre;
  edges come from firmware route reports (`parentId`/`hopCount`) with a
  heuristic fallback for nodes without an exact route
- **Node detail panel** — inline editing of name/zone/type, LED and relay
  commands with acknowledgement tracking, node deletion
- **Zones** — create, rename, and delete zones; broadcast commands to all
  nodes in a zone
- **Enrollments** — approve (with name/zone/type/node ID) or reject pending
  nodes
- **API Reference** — Swagger UI rendering the orchestrator OpenAPI spec
  (`public/openapi/v1.yaml`)
- **Integration Guides** — quickstart and command/SSE usage guides

All mutations are proxied through same-origin resource routes
(`nodes-*`/`zones-*`/`enrollments-*`), so API keys never reach the browser.
Only the SSE connection goes directly from the browser to the orchestrator.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ORCHESTRATOR_URL` | Orchestrator base URL for server-side calls (default `http://localhost:8080`) |
| `API_KEY` | Must match the orchestrator's `API_KEY`; used for reads, updates, and commands |
| `ADMIN_KEY` | Admin tier — enrollment approve/reject and node/zone deletes. May differ from `API_KEY` (falls back to it when unset) |
| `VITE_PUBLIC_API_URL` | **Build-time** orchestrator URL used by the browser for the SSE connection (default `http://localhost:8080`) |

The first three are read at runtime on the server. `VITE_PUBLIC_API_URL` is
baked in at build time (Docker build arg; set via `ARTIST_API_URL` in
`server/.env` when using Docker Compose).

## Development

Prerequisites: Node.js LTS, npm.

```bash
cd server/artist-portal
npm install
npm run dev
```

The dev server starts at `http://localhost:5173` with hot module replacement.
Export `ORCHESTRATOR_URL`, `API_KEY`, and `ADMIN_KEY` (see
`server/env.example`) to connect to a running orchestrator.

### Type checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Tests

```bash
npm test
```

Runs vitest against `app/**/*.test.ts` (currently the mesh topology layout
logic in `app/lib/topology.test.ts`).

## Production (Docker)

Run via Docker Compose from `server/`:

```bash
docker compose up -d artist-portal
```

The service listens on port `3001` and connects to the orchestrator container
on the internal `kafka-net` Docker network.

### Manual Docker build

```bash
docker build -t lattice-artist-portal \
  --build-arg VITE_PUBLIC_API_URL=http://localhost:8080 \
  server/artist-portal/
docker run -p 3001:3001 \
  -e ORCHESTRATOR_URL=http://localhost:8080 \
  -e API_KEY=your-key \
  -e ADMIN_KEY=your-admin-key \
  lattice-artist-portal
```

## Project Structure

```
app/
├── components/
│   ├── features/   # EnrollmentTable, EventFeed, NodeCard, NodeDetailPanel,
│   │               # NodeMap, NodeMapNode, ZoneCard
│   ├── layout/     # AppLayout, NavBar
│   └── ui/         # Badge, InlineEdit, SlidePanel, StatusDot
├── hooks/          # useLiveMesh — SSE subscription + node refresh
├── lib/            # topology.ts — mesh map nodes/edges/layout (+ tests)
├── routes/         # Pages: _index (Live Tracker), zones, enrollments,
│                   # api-docs, guides
│                   # Resource routes (server-side API proxies): nodes-command,
│                   # nodes-patch, nodes-delete, nodes-refresh, zones-command,
│                   # zones-update, zones-delete, enrollments-approve,
│                   # enrollments-reject
├── services/
│   ├── orchestrator.server.ts  # Server-only orchestrator API client (holds keys)
│   ├── api.ts                  # Browser → resource-route command helpers
│   └── sse.ts                  # Browser SSE connection to the orchestrator
└── types/          # Node, Zone, Enrollment, SystemStatus, SSEEvent
```

## License

Copyright (C) 2026 Lattice Contributors.
GNU General Public License v3.0 — see root [LICENSE](../../LICENSE).
