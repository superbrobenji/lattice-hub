# Lattice Orchestrator

Go service that communicates with an ESP32 mesh network over USB serial,
implementing the Lattice protocol for motion sensor management.

SPDX-License-Identifier: GPL-3.0-or-later

## Features

- USB serial interface to ESP32 master node (protobuf framing, 115200 baud)
- ESP-NOW mesh node management — configure, monitor, and broadcast
- Node health monitoring with configurable online/offline timeout
- Kafka event logging (`motion-trigger`, `mesh-messages` topics)
- Prometheus metrics endpoint
- RESTful HTTP API
- Node authentication with replay-protection persistence

## Architecture

```
┌─────────────────┐    USB Serial    ┌─────────────────┐    ESP-NOW Mesh    ┌─────────────────┐
│   Orchestrator  │ ◄──────────────► │  ESP32 Master   │ ◄─────────────────► │   Mesh Nodes    │
│                 │    115200 baud   │                 │                     │   (PIR, LED)    │
└─────────────────┘                  └─────────────────┘                     └─────────────────┘
         │
         ▼
┌─────────────────┐
│   Kafka Store   │
│  motion-trigger │
│  mesh-messages  │
└─────────────────┘
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERIAL_PORT` | `/dev/ttyUSB0` | Serial port path |
| `SERIAL_PORT_SECONDARY` | *(unset)* | Secondary serial port; only used when `DUAL_MASTER_ENABLED=true` |
| `DUAL_MASTER_ENABLED` | *(unset)* | Set to `true` to enable the secondary serial port |
| `MASTER_KEY_PATH` | `data/masterkey.json` | Path to the master's persisted Curve25519 keypair (JSON). Auto-generated at this path on first run if the file doesn't exist. |
| `MASTER_MAC` | *(unset)* | Physical WiFi MAC of the master ESP32, e.g. `aa:bb:cc:dd:ee:ff`. If unset, a startup warning is logged (`"Master MAC not configured — JOIN_ACK OriginMacAddress will be all-zero and firmware will reject enrollments"`) and every JOIN_ACK's `OriginMacAddress` is all-zero, so enrolling nodes will reject it. |
| `SECONDARY_MASTER_KEY_PATH` | `data/masterkey-secondary.json` | Path to the secondary master's persisted keypair. Only read when `DUAL_MASTER_ENABLED=true`. |
| `SECONDARY_MASTER_MAC` | *(unset)* | Physical WiFi MAC of the secondary master ESP32. Only read when `DUAL_MASTER_ENABLED=true`; if unset in that mode, a startup warning is logged (`"Dual-master enabled but SECONDARY_MASTER_MAC not configured — secondary JOIN_ACK fields will be omitted"`) and the secondary MAC/public-key fields are omitted from JOIN_ACK. |
| `BAUD_RATE` | `115200` | Serial baud rate |
| `API_PORT` | `8080` | HTTP API port |
| `KAFKA_BROKER` | `kafka:9092` | Kafka broker address |
| `KAFKA_GROUP_ID` | `1` | Kafka consumer group ID |
| `NODE_REGISTRY_PATH` | `data/nodes.json` | Node registry persistence file |
| `AUTH_REGISTRY_PATH` | `data/nodeauth.json` | Node auth/enrollment registry persistence file |
| `ZONE_REGISTRY_PATH` | `data/zones.json` | Zone registry persistence file |
| `LOG_LEVEL` | `INFO` | Log level: `DEBUG`, `INFO`, `WARN`, or `ERROR` |
| `API_KEY` | *(unset)* | API authentication key — generate with `openssl rand -hex 32`. If unset, the API-key tier runs without authentication (a warning is logged) |
| `ADMIN_KEY` | *(unset)* | Admin authentication key; may differ from `API_KEY`. If unset, admin endpoints fall back to the `API_KEY` tier (a warning is logged) |
| `ALLOWED_ORIGINS` | *(unset)* | Comma-separated CORS origin allowlist. If unset, the allowlist is empty and no CORS headers are sent |

### Command Line Flags

```bash
./mesh-server -serial=/dev/ttyUSB0 -baud=115200 -port=8080 \
  -auth-registry=data/nodeauth.json -node-registry=data/nodes.json -tx-power=2
```

| Flag | Default | Description |
|------|---------|-------------|
| `-serial` | `$SERIAL_PORT` or `/dev/ttyUSB0` | Serial port for mesh communication |
| `-baud` | `$BAUD_RATE` or `115200` | Serial baud rate |
| `-port` | `$API_PORT` or `8080` | HTTP API port |
| `-auth-registry` | `$AUTH_REGISTRY_PATH` or `data/nodeauth.json` | Path to node auth registry JSON |
| `-node-registry` | `$NODE_REGISTRY_PATH` or `data/nodes.json` | Path to node registry JSON |
| `-tx-power` | `2` | TX power preset: 0=short_range, 1=indoor, 2=outdoor |

## HTTP API

### Authentication

Endpoints are split into three tiers:

- **Public** — no authentication: `/metrics`, `/health`, and the v1 read-only
  endpoints `GET /api/v1/nodes`, `GET /api/v1/nodes/{id}`, `GET /api/v1/status`,
  and the `GET /api/v1/events` SSE stream.
- **API key** — require `Authorization: Bearer <API_KEY>`: all legacy routes,
  zone reads and writes, node updates (`PATCH`), node/zone commands, command
  status, and enrollment reads. If `API_KEY` is unset, this tier runs without
  authentication (a startup warning is logged).
- **Admin** — require `Authorization: Bearer <ADMIN_KEY>`, which may differ
  from `API_KEY`: `POST /api/v1/enrollments/{mac}/approve`,
  `POST /api/v1/enrollments/{mac}/reject`, `DELETE /api/v1/nodes/{id}`, and
  `DELETE /api/v1/zones/{id}`. If `ADMIN_KEY` is unset, these routes fall back
  to the API-key tier (a startup warning is logged).

### Public endpoints (no auth)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/health` | Liveness probe (used by Docker healthchecks) |
| `GET` | `/api/v1/nodes` | List all nodes |
| `GET` | `/api/v1/nodes/{id}` | Get a single node |
| `GET` | `/api/v1/status` | System status |
| `GET` | `/api/v1/events` | Server-sent events stream |

### v1 API (API key)

| Method | Path | Description |
|--------|------|-------------|
| `PATCH` | `/api/v1/nodes/{id}` | Update a node (name, zone, …) |
| `POST` | `/api/v1/nodes/{id}/command` | Send a command to an output node |
| `GET` | `/api/v1/nodes/{id}/command/{commandId}` | Get command acknowledgement status |
| `GET` | `/api/v1/zones` | List zones |
| `POST` | `/api/v1/zones` | Create a zone |
| `PATCH` | `/api/v1/zones/{id}` | Update a zone |
| `POST` | `/api/v1/zones/{id}/command` | Send a command to all output nodes in a zone |
| `GET` | `/api/v1/enrollments` | List all enrollment records |
| `GET` | `/api/v1/enrollments/pending` | List pending enrollments |

### v1 API (admin key)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/enrollments/{mac}/approve` | Approve a pending enrollment |
| `POST` | `/api/v1/enrollments/{mac}/reject` | Reject a pending enrollment |
| `DELETE` | `/api/v1/nodes/{id}` | Delete a node |
| `DELETE` | `/api/v1/zones/{id}` | Delete a zone |

### Legacy Node Management (API key)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/nodes` | List all known nodes |
| `GET` | `/nodes/{mac}` | Get specific node |
| `POST` | `/nodes/{mac}/configure` | Configure node adapter type |
| `POST` | `/nodes/configure-all` | Configure all nodes |

### Legacy Health & Monitoring (API key)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/health/request` | Request health reports from all nodes |
| `GET` | `/status` | Server status and statistics |

### Legacy Data & Control (API key)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/broadcast` | Broadcast data to all nodes |
| `POST` | `/server/start` | Start mesh communication |
| `POST` | `/server/stop` | Stop mesh communication |

### Legacy Enrollment Management (API key)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/enrollments` | List all enrollment records |
| `GET` | `/api/enrollments/pending` | List pending enrollments |
| `POST` | `/api/enrollments/{mac}/approve` | Approve a pending enrollment |
| `POST` | `/api/enrollments/{mac}/reject` | Reject a pending enrollment |

### TX Power (API key)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tx-power` | Get the current TX power preset |
| `POST` | `/api/tx-power` | Set the TX power preset on all nodes |

### Example requests

```bash
# Server status
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/status

# List nodes
curl -H "Authorization: Bearer $API_KEY" http://localhost:8080/nodes

# Configure a node as PIR sensor (adapterType 2)
curl -X POST -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" \
  -d '{"adapterType": 2}' \
  http://localhost:8080/nodes/aa:bb:cc:dd:ee:ff/configure

# Request health reports
curl -X POST -H "Authorization: Bearer $API_KEY" http://localhost:8080/health/request
```

## Protocol

### Transport

Serial 115200 8N1 with 2-byte little-endian length framing:

```
[2 bytes: length (little-endian)] [N bytes: protobuf message]
```

### Protocol Version Enforcement

Every message the orchestrator receives is checked in `handleMessage`
(`mesh/server.go`): `if msg.ProtoVersion != 5 { ... }`. Only `ProtoVersion 5`
is currently accepted — `0` was the legacy pre-security wire format, and
`1`–`4` are earlier revisions of the current secure format that this is a
flag-day cutover from (v4 nodes must be reflashed, not just re-paired).

A message that fails the check is **logged and dropped**, not silently
discarded: the server emits `slog.Warn("Unsupported proto version —
dropping", "version", msg.ProtoVersion, "origin", ...)` and returns without
processing the message further. No error is sent back over the wire.

See [docs/wire_protocol.md](../../docs/wire_protocol.md) for the full deep-dive, including the
enrollment handshake sequence.

### Message Types

| Type | Value | Description |
|------|-------|-------------|
| `ADAPTER_DATA` | 0 | Sensor data from mesh nodes |
| `MASTER_BEACON` | 1 | Heartbeat from master node |
| `ENROLLMENT` | 2 | Node → master: enrollment request |
| `SERIAL_CMD_BROADCAST` | 3 | Server broadcast commands |
| `JOIN_ACK` | 4 | Server → node: enrollment approved |
| `ROUTE_REPORT` | 5 | Node → server: routing path report |

### JOIN_ACK Payload Layout

JOIN_ACK's `Data` field is a fixed `MaxDataLength = 64`-byte payload built in
`mesh.ApproveEnrollment` (`mesh/server.go`). Byte layout (v0.6.0 wire shrink,
design §8):

| Bytes | Field | Notes |
|-------|-------|-------|
| `data[0..4]` | Node public-key fingerprint | First 4 bytes of the enrolling node's public key |
| `data[4..10]` | Secondary master MAC | Dual-master JOIN_ACK only; zero otherwise |
| `data[10..42]` | Secondary master public key | Dual-master JOIN_ACK only; zero otherwise |
| `data[42..64]` | Reserved | Always zero |

The secondary-master fields (bytes 4–42) are only populated when
`DUAL_MASTER_ENABLED=true` and a secondary master MAC is configured; single-
master deployments leave that range zeroed. As of lattice-protocol v0.6.0,
the top-level `SecondaryMasterMac`/`SecondaryPublicKey` proto fields (field
numbers 15/16 on the message envelope) were retired — dual-master identity
now travels exclusively inside this JOIN_ACK payload instead of separate
envelope fields.

See [docs/wire_protocol.md](../../docs/wire_protocol.md) for the full deep-dive on JOIN_ACK and
the rest of the wire protocol.

### Adapter Types

| Type | Value | Description |
|------|-------|-------------|
| `UNKNOWN` | 0 | Not yet configured |
| `SERIAL` | 1 | Serial management (internal) |
| `PIR` | 2 | Passive infrared motion sensor (input) |
| `LED` | 3 | LED strip (output) |
| `RELAY` | 4 | Relay switch (output) |
| `WIFI` | 5 | WiFi adapter (reserved, local only) |

### Control Opcodes

| Opcode | Hex | Format |
|--------|-----|--------|
| `OP_HEALTH_REQ` | `0xB0` | `[0xB0]` — server → node: request health report |
| `OP_HEALTH_REPORT` | `0xB1` | `[0xB1][adapter type][6-byte MAC][4-byte uptime LE]` — node (serial) → server |
| `OP_NODE_HEALTH` | `0xB2` | `[0xB2][adapter type][6-byte MAC][4-byte uptime LE]` — node (non-serial) → server via serial adapter |
| `OP_ROUTE_REPORT` | `0xB3` | `[0xB3][1-byte path length][N × 6-byte MACs]` — node → server: routing path |
| `OP_NODE_ID_SET` | `0xC0` | Server → node: assign logical node ID |
| `OP_CONFIG_SET` | `0xC1` | `[0xC1][6-byte target MAC][adapter type]` — server → node: set adapter type |
| `OP_TX_POWER_SET` | `0xC2` | `[0xC2][1-byte preset: 0=short_range, 1=indoor, 2=outdoor]` |
| `OP_LED_SOLID` | `0xD0` | `[0xD0][r][g][b]` — set LED strip to solid colour |
| `OP_LED_OFF` | `0xD1` | `[0xD1]` — turn LED strip off |
| `OP_RELAY_SET` | `0xD8` | `[0xD8][1 byte: 0x00=off, 0x01=on]` — set relay state |
| `OP_COMMAND_ACK` | `0xE0` | Node → server: acknowledge a received command |

## Kafka Topics

| Topic | Events |
|-------|--------|
| `motion-trigger` | PIR motion detection events (JSON) |
| `mesh-messages` | All mesh protocol messages for debugging (JSON) |

## Docker Deployment

```bash
# Start all services (from server/)
docker compose up -d

# View orchestrator logs
docker compose logs -f orchestrator

# Stop
docker compose down
```

## Development

### Prerequisites

- Go 1.25+
- Docker (for Kafka dependency)

### Build and test

```bash
cd server/orchestrator
go mod tidy
go test ./...
go vet ./...
go build -o mesh-server .
```

### Serial port permissions (Linux)

```bash
sudo usermod -a -G dialout $USER
# Log out and back in, then:
docker compose up -d
```

## Troubleshooting

**Serial port not found:**
```bash
ls /dev/ttyUSB* /dev/ttyACM*
sudo chmod 666 /dev/ttyUSB0
```

**Kafka connection refused:**
```bash
docker compose ps kafka
docker compose logs kafka
```

**API returns 401:**
Check that `API_KEY` in `server/.env` matches the header value you are sending.

## License

Copyright (C) 2026 Lattice Contributors.
This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version. See the root [LICENSE](../../LICENSE) file for the full text.
