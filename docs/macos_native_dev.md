# Running the Orchestrator Natively on macOS (Real Hardware Dev)

This documents how to run `lattice-hub` against a **real ESP32 master node** on **macOS**, for
local development. It's narrower than [`docs/getting_started.md`](getting_started.md) (which
assumes Docker can reach your hardware directly, true on Linux/Raspberry Pi) and complements
`lattice-nodes`' own
[`docs/macos_dev_bringup.md`](https://github.com/superbrobenji/lattice-nodes/blob/main/docs/macos_dev_bringup.md)
— read both together when bringing up a real board on a Mac.

**Requires the compose fixes from commit `5e10147`** (merged via
[lattice-hub#163](https://github.com/superbrobenji/lattice-hub/pull/163)). Before that commit,
`MASTER_MAC`/`MASTER_KEY_PATH` set in `.env` had no effect at all — the orchestrator's Compose
`environment:` block never referenced them, so every enrollment would silently fail no matter how
correctly `.env` was configured, with the stack still reporting healthy.

## Why this workflow exists

`server/docker-compose.yml`'s `orchestrator` service binds a host device straight into the
container: `devices: ["/dev/ttyUSB0:/dev/ttyUSB0"]`. This works on Linux (including a Raspberry
Pi, the intended production target) because the container and host share the same kernel and
device tree. **Docker Desktop on macOS cannot do this at all** — containers run inside a Linux VM
that has no visibility into host device files like `/dev/cu.usbserial-*`; there is no `/dev/ttyUSB0`
to map in even with the `devices:` directive present. This is a Docker Desktop platform limitation,
not a configuration mistake.

The practical workaround: run the **orchestrator process natively** on the Mac (direct access to
the real serial device), while everything else — Kafka, dashboard, artist portal, sidecar — stays
in Docker as normal.

If you don't need real hardware for your current task, `make stub` (hardware-free, simulated
serial backend) is simpler and doesn't require any of this — see the main
[`README.md`](../README.md) Quick Start.

## Prerequisites

- Go toolchain (matching `server/orchestrator/go.mod`'s version).
- Docker running, for Kafka + the other services.
- `esptool.py` available (installed alongside ESP-IDF in the sibling `lattice-nodes` checkout) —
  used to read the board's MAC before it's flashed.

## Step 1: Get the board's MAC

```bash
cd ../lattice-nodes
source ~/esp/esp-idf/export.sh
esptool.py --port /dev/cu.usbserial-0001 read_mac
```

## Step 2: Configure `.env`

```bash
cd server
cp env.example .env
```

Set (generating `API_KEY`/`ADMIN_KEY` with `openssl rand -hex 32`, and using the **same** value
for both — see `env.example`'s comment on the `ADMIN_KEY` wiring gap, lattice-hub#122):

```
API_KEY=<random hex>
ADMIN_KEY=<same random hex>
MASTER_KEY_PATH=data/masterkey.json
MASTER_MAC=<MAC from Step 1>
```

`SERIAL_PORT` in `.env` is irrelevant for this workflow — the native orchestrator process gets its
own environment directly (Step 5), not from Docker Compose's `.env`.

## Step 3: Fix the Kafka listener for native/host access

Kafka's `EXTERNAL` listener (meant for exactly this "client outside Docker" case) advertises
itself as `kafka:9094` by default — a hostname that only resolves *inside* the Docker network, so
it's unreachable from a natively-running process despite existing for that purpose. As of commit
`5e10147`, `server/docker-compose.yml` advertises `localhost:9094` and maps the port instead. If
your checkout predates that commit, apply the same change before continuing (see the commit for
the exact diff) — otherwise the native orchestrator will connect but every message delivery to
Kafka will fail.

## Step 4: Start the Dockerized services (minus orchestrator)

```bash
docker compose up -d
```

The dockerized `orchestrator` container **will fail to start** with something like:
```
Error response from daemon: error gathering device information while adding custom device "/dev/ttyUSB0": no such file or directory
```
That's expected — it's the exact limitation this doc works around. Stop it so it doesn't keep
retrying:

```bash
docker compose stop orchestrator
```

Confirm the rest came up:

```bash
docker compose ps
```

You should see `kafka` (healthy), `sidecar`, `artist-portal` running. `dashboard` will sit in
`Created` — its `depends_on: orchestrator: condition: service_healthy` waits on the container you
just stopped. It (and `artist-portal`'s ability to actually *reach* the orchestrator, since its
`ORCHESTRATOR_URL` is hardcoded to the Docker-network hostname `orchestrator`) won't work until
you either point them at the native orchestrator via `host.docker.internal` or accept that the
web UIs aren't available in this workflow — the REST API itself works fine either way.

## Step 5: Run the orchestrator natively

```bash
cd server/orchestrator
KAFKA_BROKER=localhost:9094 \
KAFKA_GROUP_ID=1 \
AUTH_REGISTRY_PATH=data/nodeauth.json \
NODE_REGISTRY_PATH=data/nodes.json \
ZONE_REGISTRY_PATH=data/zones.json \
MASTER_KEY_PATH=data/masterkey.json \
MASTER_MAC=<MAC from Step 1> \
SERIAL_PORT=/dev/cu.usbserial-0001 \
BAUD_RATE=115200 \
API_PORT=8080 \
API_KEY=<same as .env> \
ADMIN_KEY=<same as .env> \
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000,http://localhost:3001 \
LOG_LEVEL=INFO \
go run .
```

(Env vars must be on the *same command line* as `go run .` — `VAR=val some && go run .` only
scopes `VAR` to the first command, a mistake easy to make when splitting this across multiple
shell lines with `&&`.)

## Step 6: Verify

```bash
curl -s http://localhost:8080/api/v1/status
```

Once the board is flashed as a master and connected (see the `lattice-nodes` doc), this reports
`mesh.masterOnline: true` and, over time, incrementing `uptime` in the orchestrator's logged health
reports.

## Dual-master setup

Bench-verified end to end this session — two real boards, real failover testing. See the
`lattice-nodes` doc's "Dual-master setup" section for the firmware side (both boards need
`DUAL_MASTER_MODE=true` compiled in, and must share the *same* `master_pubkey_pin.h`). This section
covers what changes on the hub side once you have two boards flashed and one of them set to master
via its config button.

### Configure `.env`

Add to the same `.env` from Step 2 above:

```
DUAL_MASTER_ENABLED=true
SECONDARY_MASTER_KEY_PATH=data/masterkey-secondary.json
SECONDARY_MASTER_MAC=<second board's real MAC>
```

`SECONDARY_MASTER_KEY_PATH` auto-generates its own keypair on first run, same as the primary's —
this is a genuinely separate identity, used only as informational payload relayed to nodes for
TOFU-learning the secondary (not used for the firmware's compile-time pin check, which only ever
validates against the primary's pubkey — see the `lattice-nodes` doc for why).

### Run natively with both ports

Same as Step 5, plus:

```bash
DUAL_MASTER_ENABLED=true \
SECONDARY_MASTER_KEY_PATH=data/masterkey-secondary.json \
SECONDARY_MASTER_MAC=<second board's real MAC> \
SERIAL_PORT_SECONDARY=<second board's device path> \
... (rest of Step 5's env vars) ...
go run .
```

### Verify

```bash
curl -s http://localhost:8080/api/v1/status
```

Look for `"serial":{"primary":"connected","secondary":"connected"}`. **`mesh.masterOnline` only
reflects the primary** (see #166 below) — don't use it to judge whether the secondary is healthy;
watch for periodic `"Health report" mac=<secondary MAC>` lines in the orchestrator's own log
instead, which each master sends independently.

### Worked example (this session's actual boards)

| Role | MAC |
|---|---|
| Primary | `ec:64:c9:5d:ac:18` |
| Secondary | `ec:64:c9:5d:22:20` |

### Failover testing procedure (as actually run)

1. Confirm both `serial.primary`/`serial.secondary` show `"connected"` and both MACs are producing
   periodic health reports in the log.
2. Physically unplug one master. Watch the *other* master's health reports keep arriving on
   schedule, uninterrupted — that's the real signal a healthy independent link, not the
   `masterOnline` field (see #166).
3. Physically replug the same board. **It will not self-heal** (#161/#162) — the device path may
   also have changed (`ls /dev/cu.usbserial-*` before assuming which path to use; ours shifted from
   `usbserial-3` to `usbserial-4` on one replug, and stayed the same on another — not consistent).
4. Restart the orchestrator with the (possibly new) device path. Usually recovers within seconds —
   but occasionally the restart itself doesn't fully recover (#167: the read loop can get silently
   stuck even after successfully reopening the port). If a fresh restart doesn't produce a health
   report within ~30-60s, restart again rather than assuming the board is broken.

Ran this in both directions (unplug primary / unplug secondary) — confirmed each master's link is
fully independent of the other's state either way.

## Known issues affecting this workflow

- [lattice-hub#161](https://github.com/superbrobenji/lattice-hub/issues/161): the orchestrator
  never attempts to reconnect after the serial connection drops — `serial.Open()` is a one-shot
  call at startup with no retry loop, unlike the `tcp://` stub-mode transport which does retry.
  **Any physical unplug/replug requires manually killing and restarting the orchestrator process**
  (repeat Step 5) — it will not recover on its own, even on the exact same device path, and
  `serial.primary`/`serial.secondary` in `/api/v1/status` will keep reporting `"connected"` even
  after the link is dead, which makes this easy to miss.
- [lattice-hub#162](https://github.com/superbrobenji/lattice-hub/issues/162): even after
  restarting the orchestrator, a hot-replugged board may not respond to a bare reopen of the
  serial port — it can take an explicit reset pulse (e.g. running `idf.py -p <port> monitor`,
  which drives DTR/RTS in ESP-IDF's standard reset sequence) to revive it. If restarting the
  orchestrator alone doesn't bring the connection back, try that before assuming the board itself
  is broken.
- [lattice-hub#166](https://github.com/superbrobenji/lattice-hub/issues/166): `mesh.masterOnline`
  in `/api/v1/status` only tracks the primary link. It reads `false` while a perfectly healthy
  secondary is serving, and `true` while a dead secondary goes unnoticed. Watch each master's own
  health-report stream in the log, not this field, to judge dual-master health.
- [lattice-hub#167](https://github.com/superbrobenji/lattice-hub/issues/167): occasionally a
  restart's read loop gets stuck mid-session (distinct from #161 — the connection was never fully
  dropped, the recovery path itself wedged) with no further log output to indicate it. If a restart
  doesn't produce a health report within the normal interval, restart again.
