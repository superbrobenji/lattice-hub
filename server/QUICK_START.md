<!--
SPDX-License-Identifier: GPL-3.0-or-later
Copyright (C) 2026 Lattice Contributors
-->

# Quick Start

## Prerequisites

- Docker and Docker Compose
- (Optional) ESP32 master node connected via USB for node enrollment

## 1. Environment Setup

```bash
cp env.example .env
```

Edit `.env` and set these required variables:

```
API_KEY=<generate with: openssl rand -hex 32>
ADMIN_KEY=<generate with: openssl rand -hex 32>
```

Both keys ship as placeholders in `env.example` and must be replaced — Compose refuses to start without them. `ADMIN_KEY` guards the admin tier (enrollment approve/reject, hard deletes, Dashboard sign-in) and may differ from `API_KEY`; every container receives both. All other variables have working defaults for local development.

## 2. Start the Stack

```bash
docker compose up -d
```

This starts:
| Service | Port | Description |
|---------|------|-------------|
| Orchestrator API | 8080 | REST API v1 and mesh server |
| Dashboard | 3000 | Admin UI — monitoring, enrollment, and infrastructure management |
| Artist Portal | 3001 | Artist workspace UI |
| Sidecar | 9000 | Container health, logs, and Kafka monitoring |
| Kafka | 9092 | Event stream (internal) |

## 3. Verify Services

```bash
curl http://localhost:8080/api/v1/status
```

Expected response (no nodes enrolled yet):
```json
{"success":true,"data":{"serial":{"primary":"connected","secondary":"not_configured"},"nodes":{"total":0,"online":0,"offline":0,"nextFreeId":1},"mesh":{"masterOnline":true,"primaryOnline":true,"secondaryOnline":false}}}
```

## 4. Enroll a Node

Before enrolling against real firmware, the orchestrator needs a master identity configured —
skip this against a real ESP32 master and every enrollment will silently fail (see below).

### Configure the Master Identity

Enrollment relies on two pieces of master-identity config in `.env`:

- `MASTER_KEY_PATH` — path to the master's persisted Curve25519 keypair. You don't need to
  generate this yourself: the orchestrator auto-generates and persists a keypair at this path
  on first run if the file doesn't exist. The default (`data/masterkey.json`) works for local
  development.
- `MASTER_MAC` — the physical WiFi MAC address of the master ESP32 (e.g. `aa:bb:cc:dd:ee:ff`).
  This *is* required, and there's no tooling in this repo to read it automatically — obtain it
  from the device itself (e.g. a label on the board, or ESP32 flashing/debug tooling such as
  `esptool.py read_mac` over the same USB connection used for enrollment), then set it in `.env`.

If `MASTER_MAC` is left unset, the orchestrator logs a startup warning and every `JOIN_ACK` it
sends carries an all-zero origin MAC address — connected firmware will reject the enrollment.
This is easy to miss because the stack still starts up and looks healthy; only the enrollment
handshake itself fails.

(Running dual-master failover? `SECONDARY_MASTER_KEY_PATH` and `SECONDARY_MASTER_MAC` work the
same way and are only read when `DUAL_MASTER_ENABLED=true`.)

After connecting an ESP32 master node via USB:

### Check Pending Enrollments

```bash
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8080/api/v1/enrollments/pending
```

### Approve via cURL

Approval is an admin-tier operation and is keyed by the node's MAC address:

```bash
curl -X POST http://localhost:8080/api/v1/enrollments/<mac>/approve \
  -H "Authorization: Bearer $ADMIN_KEY"
```

An optional JSON body can set node details at approval time, e.g. `{"name":"hallway","zone":"ground-floor","type":"PIR","nodeId":3}`. Rejection works the same way via `/api/v1/enrollments/<mac>/reject`.

Or use the **Dashboard** (step 6) for a UI-based approval workflow.

## 5. Artist Portal

Open your browser and navigate to:

```
http://localhost:3001
```

The Artist Portal is where users create and manage installations, configure nodes, and design motion-reactive visuals.

## 6. Dashboard

Open your browser and navigate to:

```
http://localhost:3000
```

You will be prompted for the `ADMIN_KEY` at login (stored in a session cookie). The Dashboard provides:
- Node enrollment and approval workflow
- Node monitoring and server controls
- Live events and infrastructure health (container status, logs, restarts)

## 7. Development with Jupyter

To include Jupyter for development and experimentation, use the development compose override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Jupyter will be available at `http://localhost:8888`.

## USB Serial Device Setup

### Standard Linux

```bash
# Find your device
ls /dev/ttyUSB* /dev/ttyACM*

# Grant access
sudo usermod -a -G dialout $USER
# Log out and back in

# Update .env
SERIAL_PORT=/dev/ttyUSB0
```

### macOS

```bash
# Check for connected device
ls /dev/tty.usbserial* /dev/tty.usbmodem*

# Update .env with the device path
SERIAL_PORT=/dev/tty.usbserial-0001
```

### Proxmox Container

If running inside a Proxmox LXC with USB passthrough:

```bash
# Find the USB device path
ls /dev/bus/usb/*/

# Example: /dev/bus/usb/003/002
# Update docker-compose.yml devices section:
#   devices:
#     - "/dev/bus/usb/003/002:/dev/ttyUSB0"
```

## Troubleshooting

### Services not starting

```bash
docker compose ps
docker compose logs orchestrator
docker compose logs kafka
```

### Serial port errors

```bash
ls -la /dev/ttyUSB0
sudo chmod 666 /dev/ttyUSB0
```

### API returns 401/403

Verify your API keys:
```bash
grep API_KEY .env
grep ADMIN_KEY .env
```

If you changed either key in `.env` while the stack was already running, run `docker compose up -d`
again — a plain `restart` keeps the old environment, so the containers keep checking against the
old keys.

Ensure the correct header is used:
- Public endpoints (`/health`, `/metrics`, and v1 reads like `/api/v1/status`, `/api/v1/nodes`, `/api/v1/events`): no auth required
- Protected endpoints: `-H "Authorization: Bearer $API_KEY"`
- Admin endpoints (enrollment approve/reject, node/zone delete): `-H "Authorization: Bearer $ADMIN_KEY"`

### Clean rebuild

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Next Steps

See [orchestrator/README.md](orchestrator/README.md) for the full API reference, protocol documentation, and advanced configuration options.
