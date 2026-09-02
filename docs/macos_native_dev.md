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

Set (generating `API_KEY` and `ADMIN_KEY` separately with `openssl rand -hex 32`):

```
API_KEY=<random hex>
ADMIN_KEY=<second random hex>
MASTER_KEY_PATH=data/masterkey.json
MASTER_MAC=<MAC from Step 1>
```

`SERIAL_PORT` in `.env` is irrelevant for this workflow — the native orchestrator process gets its
own environment directly (Step 5), not from Docker Compose's `.env`.

> **`MASTER_KEY_PATH` is the hub's *own* identity, not the firmware pin.** The orchestrator
> auto-generates `data/masterkey.json` on first start and uses it as its own keypair. It is **not**
> what leaf firmware pins against: `lattice-nodes`' `master_pubkey_pin.h` must be generated from the
> master *board's* own key — the `LATTICE_PUBKEY:` line it prints over serial at boot — plus its MAC
> (see `lattice-nodes`' `docs/macos_dev_bringup.md` Steps 2–3 and
> [lattice-nodes#126](https://github.com/superbrobenji/lattice-nodes/issues/126)). You never need to
> copy `masterkey.json` anywhere, and a pin derived from it will never let a node enroll.

## Step 3: Fix the Kafka listener for native/host access

Kafka's `EXTERNAL` listener (meant for exactly this "client outside Docker" case) advertises
itself as `kafka:9094` by default — a hostname that only resolves *inside* the Docker network, so
it's unreachable from a natively-running process despite existing for that purpose. As of commit
`5e10147`, `server/docker-compose.yml` advertises `localhost:9094` and maps the port instead. If
your checkout predates that commit, apply the same change before continuing (see the commit for
the exact diff) — otherwise the native orchestrator will connect but every message delivery to
Kafka will fail.

## Step 4: Start the Dockerized services (minus orchestrator)

From `server/`:

```bash
docker compose -f docker-compose.yml -f docker-compose.native.yml up -d
```

(`make native` from the repository root runs the same command.) The
`docker-compose.native.yml` overlay does three things the plain stack can't on macOS:

- parks the `orchestrator` container behind a Compose profile, so `up` skips it instead of
  failing with `error gathering device information while adding custom device "/dev/ttyUSB0"`;
- drops `dashboard`'s `depends_on: orchestrator: condition: service_healthy`, which would
  otherwise leave it stuck in `Created` forever;
- adds `extra_hosts: orchestrator:host-gateway` to `dashboard` and `artist-portal`, so the
  `orchestrator` hostname their `ORCHESTRATOR_URL` already uses resolves to your Mac, where the
  native process from Step 5 listens on `:8080`.

Confirm it came up:

```bash
docker compose ps
```

You should see `kafka` (healthy), `sidecar`, `dashboard` and `artist-portal` running, and no
`orchestrator` container at all. The web UIs answer once Step 5's process is up; until then the
Dashboard pages that query the orchestrator (Nodes, Enrollments) error out, which is expected.

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
reports. The Dashboard at `http://localhost:3000` (sign in with `ADMIN_KEY`) and the Artist Portal
at `http://localhost:3001` now reach the native orchestrator through the overlay from Step 4.

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
TOFU-learning the secondary. It is not used for the firmware's compile-time pin check, which only
ever validates against the primary *board's* own on-device pubkey — neither this file nor
`masterkey.json` is what leaves pin against (see the `lattice-nodes` doc and
[lattice-nodes#126](https://github.com/superbrobenji/lattice-nodes/issues/126)).

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

Look for `"serial":{"primary":"connected","secondary":"connected"}` and
`"mesh":{"masterOnline":true,"primaryOnline":true,"secondaryOnline":true}`. `primaryOnline` and
`secondaryOnline` each track their own serial link (a frame within the last 75s), and
`masterOnline` is `true` while either master is online. As a cross-check, watch for periodic
`"Health report" mac=<secondary MAC>` lines in the orchestrator's own log, which each master sends
independently.

### Worked example (this session's actual boards)

| Role | MAC |
|---|---|
| Primary | `ec:64:c9:5d:ac:18` |
| Secondary | `ec:64:c9:5d:22:20` |

### Failover testing procedure (as actually run)

1. Confirm both `serial.primary`/`serial.secondary` show `"connected"` and both MACs are producing
   periodic health reports in the log.
2. Physically unplug one master. Watch the *other* master's health reports keep arriving on
   schedule, uninterrupted, and `mesh.primaryOnline` / `mesh.secondaryOnline` flip to `false`
   for the unplugged link only (after the 75s health timeout) while `masterOnline` stays `true`.
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
- [lattice-hub#167](https://github.com/superbrobenji/lattice-hub/issues/167): occasionally a
  restart's read loop gets stuck mid-session (distinct from #161 — the connection was never fully
  dropped, the recovery path itself wedged) with no further log output to indicate it. If a restart
  doesn't produce a health report within the normal interval, restart again.
