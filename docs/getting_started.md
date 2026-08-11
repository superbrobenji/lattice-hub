<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- Copyright (C) 2026 Lattice Contributors -->

# Getting Started: Running `lattice-hub` From Zero

This guide walks you from an empty computer to a running Lattice Hub server —
the Docker-based service that talks to your ESP32 mesh over USB, stores
events, and exposes a REST API and two web UIs. It assumes **no prior
Docker or server-operations experience**. You do need to be comfortable
opening a terminal window, copying a command, pasting it in, and pressing
Enter — every command below is written to be copied exactly as shown.

A "terminal" is the text-based command window: **Terminal** on macOS, your
distribution's terminal app on Linux (e.g. GNOME Terminal, Konsole), or
**Command Prompt** / **PowerShell** on Windows.

If something goes wrong at any step, skip ahead to
[Troubleshooting](#6-troubleshooting) — several specific, verified failure
modes are covered there in detail.

## Contents

1. [What you'll end up with](#1-what-youll-end-up-with)
2. [Step 1: Install Docker](#2-step-1-install-docker)
3. [Step 2: Clone the repo and configure your environment](#3-step-2-clone-the-repo-and-configure-your-environment)
4. [Step 3: Start the stack and verify it's healthy](#4-step-3-start-the-stack-and-verify-its-healthy)
5. [Step 4: Connect your first ESP32 master node](#5-step-4-connect-your-first-esp32-master-node)
6. [Troubleshooting](#6-troubleshooting)
7. [What's next](#7-whats-next)

---

## 1. What you'll end up with

By the end of this guide you'll have five Docker containers running on your
computer, working together as one system:

| Service | What it does | Address once running |
|---|---|---|
| **Orchestrator** | The core Go server. Talks to your ESP32 "master" node over USB serial, exposes the REST API, and relays events into Kafka. | `http://localhost:8080` |
| **Dashboard** | Admin web UI — monitoring, node enrollment approval, infrastructure management. | `http://localhost:3000` |
| **Artist Portal** | A second, more limited web UI aimed at non-admin users. | `http://localhost:3001` |
| **Sidecar** | A small API the Dashboard's "Infrastructure" page uses to show container health/logs and Kafka status. Not meant to be opened directly in a browser. | `http://localhost:9000` |
| **Kafka** | Internal event stream the other services use to pass messages around. You won't interact with this directly. | `localhost:9092` (internal) |

**This guide does not cover building or flashing ESP32 firmware.** That's a
separate repository, [`lattice-nodes`](https://github.com/superbrobenji/lattice-nodes),
with its own [getting-started guide](https://github.com/superbrobenji/lattice-nodes/blob/main/docs/getting_started.md).
This guide gets the server side running and, in
[Step 4](#5-step-4-connect-your-first-esp32-master-node), shows you how to
recognize a real (or simulated) ESP32 node from the hub's side and bring it
into the mesh.

**You do not need real ESP32 hardware to complete most of this guide.** A
"stub" mode swaps the physical USB/serial connection for a software
simulator, so you can get the whole server stack running, log into both web
UIs, and even walk through the node-enrollment flow, all without owning a
single board. Where hardware is needed, it's called out explicitly.

## 2. Step 1: Install Docker

`lattice-hub` runs as a set of **Docker containers** — a container is a
lightweight, self-contained package with everything a piece of software
needs to run, so it behaves the same on your machine as it does everywhere
else. **Docker Compose** is the tool that starts, stops, and coordinates a
group of related containers (in this case, the five services listed above)
from one set of config files. You don't need to understand containers
deeply to follow this guide — just know that "start the stack" below means
"start all five of those containers together."

### macOS

1. Download **Docker Desktop** from
   [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
2. Open the downloaded file and drag Docker to your Applications folder (or
   run the installer, depending on which download you got).
3. Launch Docker Desktop from your Applications folder. The first launch
   takes a little while and may ask for your password (it needs system
   permissions to manage containers). Wait until the whale icon in your
   menu bar stops animating — that means Docker has finished starting.

### Windows

1. Download **Docker Desktop** from
   [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
2. Run the installer. If prompted, accept enabling **WSL2** (Windows
   Subsystem for Linux) — Docker Desktop on Windows requires it, and the
   installer will guide you through enabling it if it isn't already.
3. Restart your computer if the installer asks you to.
4. Launch Docker Desktop from the Start Menu and wait for it to finish
   starting (the whale icon in your system tray stops animating).
5. Run all commands in this guide from **Command Prompt** or **PowerShell**.

### Linux

Docker Desktop also exists for Linux, but a lighter-weight option — **Docker
Engine** plus the **Compose plugin** — is more common on servers and is
what these instructions install.

On Debian/Ubuntu-based systems:

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

- The first command runs Docker's official install script, which detects
  your distribution and installs Docker Engine, the CLI, and the Compose
  plugin together.
- The second command adds your user to the `docker` group, so you don't
  need to type `sudo` before every Docker command. **Log out and back in**
  (or reboot) for this to take effect.

(Other distributions, or if you'd rather not run a piped install script,
see [Docker's official Linux install docs](https://docs.docker.com/engine/install/)
for your specific distribution.)

### Verify the install

In a terminal, run:

```bash
docker compose version
```

A successful install prints something like:

```
Docker Compose version v2.24.0
```

(Note: `docker-compose.stub.yml`, used later in this guide, needs Compose
**v2.17 or newer** for a YAML feature it relies on — any Docker
Desktop/Engine install from the last couple of years satisfies this
comfortably.)

If instead you see `command not found` (macOS/Linux) or `'docker' is not
recognized...` (Windows), Docker isn't installed correctly, or Docker
Desktop isn't running yet — make sure the whale icon in your menu
bar/system tray shows Docker as started, then try again.

## 3. Step 2: Clone the repo and configure your environment

In your terminal, run:

```bash
git clone https://github.com/superbrobenji/lattice-hub.git
cd lattice-hub/server
```

Every remaining command in this guide is run from this `server` folder —
that's where the Docker Compose files live.

### Create your `.env` file

Docker Compose reads its configuration — API keys, ports, file paths — from
a file named `.env` in this folder. It isn't checked into the repository
(each deployment needs its own), so you copy it from a template:

```bash
cp env.example .env
```

Now open `.env` in any text editor. You need to set two things before the
stack will start at all, and a third that's critical for enrolling real
hardware later.

#### `API_KEY` and `ADMIN_KEY`

```
API_KEY=change-me-before-deploy
ADMIN_KEY=change-me-too-before-deploy
```

These ship as obvious placeholders. Generate a random value and replace
**both** placeholders with it:

```bash
openssl rand -hex 32
```

Run this once and paste the result in as the value for *both* variables —
for example `API_KEY=3f9a1c...` and `ADMIN_KEY=3f9a1c...` (the same 64 hex
characters in both places).

`API_KEY` is meant to guard the regular REST API, and `ADMIN_KEY` is meant
to separately guard admin-tier operations (approving/rejecting node
enrollments, hard deletes, and signing into the Dashboard). **Use the same
value for both for now anyway.** There's a currently-open wiring gap
([lattice-hub#122](https://github.com/superbrobenji/lattice-hub/issues/122))
where the orchestrator container never actually receives `ADMIN_KEY` when
you run the real (non-stub) stack — its admin-tier checks silently fall
back to comparing against `API_KEY` instead. If the two values differ, node
enrollment approval breaks, both via curl and via the Dashboard's Approve
button — see the callout in
[Step 4](#5-step-4-connect-your-first-esp32-master-node) and the
[Troubleshooting](#6-troubleshooting) entry for the full explanation. Making
them identical for now sidesteps the bug entirely; once #122 is fixed, you
can safely split them into two different values.

(If you're planning to use the hardware-free **stub** stack rather than
real hardware, there's a second, stub-specific wrinkle — covered in
[Step 3](#4-step-3-start-the-stack-and-verify-its-healthy) — so don't worry
about matching a specific value here beyond "both the same.")

**Important nuance:** Docker Compose refuses to start the stack if either
variable is completely **empty or missing** from `.env` — but it has no way
to know if you've left the placeholder text in place. If you skip this step,
the stack will start up looking perfectly healthy, just insecurely, with
the literal string `change-me-before-deploy` as your API key. Don't skip
replacing these.

#### Export them in your terminal too

Several `curl` examples later in this guide reference `$API_KEY` and
`$ADMIN_KEY` as shell variables, for convenience and so you're not
copy-pasting a secret around by hand. Make that work by exporting the same
values in the terminal window you'll keep using for the rest of this guide:

```bash
export API_KEY=<the value you just put in .env>
export ADMIN_KEY=<the same value, since you just made them match>
```

(`export`, not just setting the variable, matters here — it makes the value
available to the `curl` commands you'll run as separate commands later,
not just the one command it's typed in front of. If you close this terminal
and open a new one, you'll need to run these two lines again — or just
substitute the actual value directly into any `curl` command instead.)

#### `MASTER_KEY_PATH` and `MASTER_MAC` — needed for real enrollment

```
MASTER_KEY_PATH=data/masterkey.json
MASTER_MAC=
```

Skip this sub-section entirely if you're only running the stub stack in
this guide with no real hardware yet — it doesn't matter until you connect
a real ESP32. If you *do* plan to enroll a real node by the end of this
guide, read on now, since setting `MASTER_MAC` requires having your master
board in hand.

- **`MASTER_KEY_PATH`** points to the hub's own persisted identity keypair.
  You don't need to create this file yourself — the orchestrator generates
  and saves one here automatically the first time it starts, if the file
  doesn't already exist. The default (`data/masterkey.json`) is fine for
  local use. (A known first-run snag with this auto-generation, and its
  fix, is covered in [Troubleshooting](#6-troubleshooting) — check there if
  the file never appears.)
- **`MASTER_MAC`** is the physical WiFi MAC address of the one ESP32 board
  that will be your **master** — the board wired to this computer over
  USB. This one *cannot* be auto-generated, and there's no tooling in this
  repo to read it for you. Get it from the board itself: either a label on
  it, or by running `esptool.py read_mac` (installed as part of the ESP-IDF
  toolchain used by `lattice-nodes`) while the board is connected over USB.
  Set it like `MASTER_MAC=aa:bb:cc:dd:ee:ff`.

  **If you leave this blank**, the stack still starts and looks completely
  healthy — but every node that tries to enroll will silently fail,
  because the orchestrator sends an all-zero master address in its
  enrollment reply and connected firmware rejects it. This is the single
  most common "it looks fine but nothing works" trap — see
  [Troubleshooting](#6-troubleshooting).

Two more variables, `SECONDARY_MASTER_KEY_PATH` and `SECONDARY_MASTER_MAC`,
work the same way for a second, redundant master board — they're only read
if you also set `DUAL_MASTER_ENABLED=true`. Leave them alone for a standard
single-master setup.

Everything else in `.env` (serial port, Kafka settings, log level, data
file paths) has a working default for local use — you don't need to touch
it for this guide.

## 4. Step 3: Start the stack and verify it's healthy

### If you don't have an ESP32 yet: use the hardware-free "stub" stack

The plain stack expects a real USB serial device to exist on your computer
the moment the orchestrator container starts — if you don't have a board
plugged in yet, starting it will fail outright (see
[Troubleshooting](#6-troubleshooting) if you hit this by accident). Instead,
run:

```bash
export API_KEY=dev
export ADMIN_KEY=dev
docker compose -f docker-compose.yml -f docker-compose.stub.yml up -d --build
```

This is the same stack, with one difference: a `mesh-sim` container stands
in for your serial-attached ESP32, simulating mesh traffic over a network
connection instead of real USB. Everything else below behaves identically.

**About those two `export` lines — they're not optional for the stub
stack.** `docker-compose.stub.yml` hardcodes the orchestrator's own
`API_KEY`/`ADMIN_KEY` to the literal string `dev`, ignoring whatever's in
`.env`. The Dashboard and Artist Portal containers are *not* overridden the
same way — by default they'd send the real value from your `.env`, which
the orchestrator (stuck on `dev`) would then reject. Exporting `dev` for
both in your shell first means every `docker compose` command you run in
*this terminal window* — this one and the ones that follow, including the
`curl`/login steps below — consistently uses `dev`, overriding the exports
from [Step 2](#3-step-2-clone-the-repo-and-configure-your-environment) for
as long as you're working with the stub stack in this window. This is
exactly what this repo's `make stub` shortcut does under the hood, if
you'd rather use that instead. When you're done with the stub stack and
want to go back to real values (e.g. a fresh terminal window, or
re-exporting your `.env` values), the real stack will use those again.

The first run also needs to build several container images from source
(hence `--build` above; you can drop it on later runs where you haven't
changed any code), which can take a few minutes and prints a long stream of
build output. This is normal.

### If you have a real ESP32 master connected

Plug your master board into this computer via USB **before** running the
next command — the orchestrator container is configured to grab a specific
serial device by name at startup, and won't start at all if that device
doesn't yet exist (see [Step 4](#5-step-4-connect-your-first-esp32-master-node)
and [Troubleshooting](#6-troubleshooting) for what to do if your board shows
up under a different device name than expected, which is common on
macOS/Windows). Once it's plugged in:

```bash
docker compose up -d
```

### Check that everything came up healthy

Either way, once the command finishes, check the state of all five (or six,
in stub mode) containers:

```bash
docker compose ps
```

(If you used the stub overlay, add `-f docker-compose.stub.yml` to this
command too, same as when you started it — Compose needs to know about
both files to find all the containers.)

You're looking for the `STATUS` column. Three services — **kafka**,
**orchestrator**, and **dashboard** — each define an internal health check,
so once they're ready you'll see `Up ... (healthy)` next to them. (Right
after starting, you may briefly see `(health: starting)` instead — give it
10–30 seconds and check again.) The other two — **artist-portal** and
**sidecar** — don't define a health check at all, so you'll just see
`Up ...` with no health annotation next to them; that's expected, not a
problem.

If any service shows `(unhealthy)`, or keeps restarting, see
[Troubleshooting](#6-troubleshooting).

### Take a look

- **Orchestrator health check**: `curl http://localhost:8080/health` should
  print `{"ok":true}`.
- **Orchestrator status**: `curl http://localhost:8080/api/v1/status` should
  print something like:
  ```json
  {"success":true,"data":{"mesh":{"masterOnline":true},"nodes":{"nextFreeId":1,"offline":0,"online":0,"total":0},"serial":{"primary":"connected","secondary":"not_configured"}}}
  ```
  (`nodes.total: 0` is expected — you haven't enrolled anything yet.)
- **Dashboard**: open `http://localhost:3000` in a browser. It redirects
  you to a login screen — sign in with your **`ADMIN_KEY`** value (not
  `API_KEY`; the Dashboard's own login is keyed off the admin key
  specifically). If you're running the stub stack, that's the literal word
  `dev` (per the `export ADMIN_KEY=dev` above) — not whatever's written in
  `.env`, since the stub run's Dashboard container picked up `dev` from
  your shell, overriding the file.
- **Artist Portal**: open `http://localhost:3001` in a browser.

You don't need to open the Sidecar (`:9000`) directly — the Dashboard's
"Infrastructure" page talks to it on your behalf.

## 5. Step 4: Connect your first ESP32 master node

This section describes recognizing a node from the hub's side. Building and
flashing the firmware itself happens in the separate `lattice-nodes`
repository — see its
[getting-started guide](https://github.com/superbrobenji/lattice-nodes/blob/main/docs/getting_started.md)
for that half.

### What you should see from the node

Once a freshly flashed ESP32 boots (whether it's your master or any other
node) and hasn't yet been approved by a hub, `lattice-nodes`' firmware
prints one line to its own serial/USB output:

```
LATTICE_PUBKEY:3A7F2B91C4D06E5F8A1B2C3D4E5F60718293A4B5C6D7E8F90A1B2C3D4E5F607A
```

— `LATTICE_PUBKEY:` followed by 64 hex characters, the node's public
identity. That line is what you'll match up against what the hub reports
below. Once a hub approves the node, this line stops appearing on future
boots.

### How to confirm the hub sees it

An unenrolled node that has reached the hub over the mesh shows up as a
**pending enrollment**. Check for it with:

```bash
curl -H "Authorization: Bearer $API_KEY" \
  http://localhost:8080/api/v1/enrollments/pending
```

A pending node looks like:

```json
{"success":true,"data":[{"mac":"aa:bb:cc:dd:ee:99","publicKey":"...","status":0,"receivedAt":1786447687,"approvedAt":-62135596800}]}
```

(`status: 0` means pending; ignore the odd-looking `approvedAt` value —
that's just the zero-value timestamp for "not yet approved.")

Or, in the Dashboard (signed in with `ADMIN_KEY`, per
[Step 3](#4-step-3-start-the-stack-and-verify-its-healthy)), open the
**Enrollments** page from the sidebar — the same pending node appears there
in a table, with an Approve/Reject action for each row.

### Approving it

Via the Dashboard's Enrollments page, click **Approve** and optionally fill
in a name and zone. Via curl, this is conceptually an admin-tier action —
the request needs `ADMIN_KEY`:

```bash
curl -X POST http://localhost:8080/api/v1/enrollments/<mac>/approve \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"hallway","zone":"ground-floor","type":"PIR","nodeId":3}'
```

The JSON body is optional — all four fields (`name`, `zone`, `type`,
`nodeId`) may be omitted. Rejecting works the same way, against
`/api/v1/enrollments/<mac>/reject`.

> **Why this works today, and what's actually going on underneath.** If you
> followed [Step 2](#3-step-2-clone-the-repo-and-configure-your-environment)'s
> guidance to make `API_KEY` and `ADMIN_KEY` identical, the command above —
> and the Dashboard's Approve button — will just work, both in stub mode and
> against real hardware. But the *reason* it works is currently a bit
> backwards from what you'd expect, and worth knowing about
> ([lattice-hub#122](https://github.com/superbrobenji/lattice-hub/issues/122)):
> - In **stub mode**, the orchestrator only ever accepts the literal string
>   `dev` for either key (see [Step 3](#4-step-3-start-the-stack-and-verify-its-healthy)) —
>   `$ADMIN_KEY` only works above because you `export`ed `API_KEY=dev` and
>   `ADMIN_KEY=dev` before starting the stack.
> - Against **real hardware** (the plain, non-stub stack), the orchestrator
>   container never receives `ADMIN_KEY` at all — only `API_KEY`. Its
>   admin-tier check silently falls back to comparing against `API_KEY`
>   instead. So `-H "Authorization: Bearer $ADMIN_KEY"` above only succeeds
>   because your `.env` made `$ADMIN_KEY` and `$API_KEY` the same value; if
>   you ever set them differently, this exact command — and the Dashboard's
>   Approve button, which always sends `ADMIN_KEY` — will fail with `401`/
>   `500` even though everything else about the stack looks perfectly
>   healthy. See [Troubleshooting](#6-troubleshooting) if you hit that.

Once approved, the node disappears from the pending list and shows up in
`curl http://localhost:8080/api/v1/nodes` (and the Dashboard's Nodes page)
instead.

### No hardware yet? Rehearse this exact flow with the stub stack

If you started the stub stack in [Step 3](#4-step-3-start-the-stack-and-verify-its-healthy),
you can trigger a simulated node exactly like a real one would appear,
without any hardware:

```bash
curl -X POST http://localhost:9001/sim/nodes \
  -H "Content-Type: application/json" \
  -d '{"mac":"aa:bb:cc:dd:ee:99","type":"pir"}'
```

Within a few seconds it appears in `GET /api/v1/enrollments/pending` and the
Dashboard's Enrollments page exactly as described above, and can be
approved the same way. This is a genuinely useful way to practice the
enrollment workflow, or verify your hub setup, before you ever touch a
physical board.

## 6. Troubleshooting

**A service shows `(unhealthy)` in `docker compose ps`, or keeps
restarting.**
Check that service's logs: `docker compose logs <service-name>` (e.g.
`docker compose logs orchestrator`). The orchestrator and dashboard both
fail their health check by trying to reach an HTTP endpoint on themselves
(`/health` on the orchestrator, `/` on the dashboard) — if either can't
bind its port or crashes on startup, the logs will show why.

**Nodes show up as pending forever / a real node never enrolls, but the
stack looks completely healthy.**
This is almost always a missing `MASTER_MAC`. Check the orchestrator's
logs for this line:
```
Master MAC not configured — JOIN_ACK OriginMacAddress will be all-zero and firmware will reject enrollments
```
If you see it, set `MASTER_MAC=aa:bb:cc:dd:ee:ff` (your master board's real
WiFi MAC) in `.env`, then `docker compose up -d` again to pick up the
change. See [Step 2](#3-step-2-clone-the-repo-and-configure-your-environment)
for how to obtain the MAC.

**Orchestrator logs show `Failed to load or generate master keypair` with a
`permission denied` error, and `data/masterkey.json` never appears.**
On a genuinely fresh install, the orchestrator's data volume is initially
owned by `root` on the Docker host side, while the orchestrator process
itself deliberately runs as a restricted, non-root user with no elevated
Linux capabilities (part of this repo's container hardening) — so it can't
write its own keypair into that directory yet. One-time fix, run from the
`server` folder:

```bash
docker run --rm -v "$(docker volume ls -q --filter name=orchestrator_data)":/data alpine chown -R 1001:1001 /data
docker compose restart orchestrator
```

The first command borrows a temporary, unrestricted container to fix the
ownership of the shared data volume from the outside; the second restarts
the orchestrator so it can generate and persist `masterkey.json`
successfully. You only need to do this once per fresh volume — check
`docker compose logs orchestrator` afterward to confirm the warning is
gone. (The same root cause can also show up as `nodes.json`/`zones.json`
persistence warnings, since they live in the same directory — the fix
above covers all of them at once.)

**`docker compose up -d` fails immediately with something like `error
gathering device information while adding custom device
"/dev/ttyUSB0": no such file or directory`.**
The plain (non-stub) stack expects a real serial device at `/dev/ttyUSB0`
to already exist on your computer the moment the orchestrator container
starts. Either:
- Plug your ESP32 master in via USB first, so that device exists, then
  retry, **or**
- If you don't have hardware yet, use the stub stack instead — see
  [Step 3](#4-step-3-start-the-stack-and-verify-its-healthy).

**My ESP32 is plugged in, but the orchestrator still can't find it (same
error as above), or connects to the wrong device.**
`docker-compose.yml` maps a specific, fixed device path — `/dev/ttyUSB0` —
into the container, regardless of what you set `SERIAL_PORT` to in `.env`.
On Linux this is usually right, but if your board enumerates under a
different name (`/dev/ttyUSB1`, etc. — e.g. because another serial device
is already using `ttyUSB0`), or you're on **macOS** (where boards show up
as `/dev/cu.usbserial-...` or similar, never `/dev/ttyUSB0`), you need to
edit the `devices:` line under the `orchestrator` service in
`docker-compose.yml` to match your board's actual path on the host, in
addition to setting `SERIAL_PORT` in `.env` to the same path.

**`Bind for 0.0.0.0:3000 failed: port is already allocated`** (or the same
for another port, e.g. `8080`, `3001`, `9000`, `9092`).
Something else on your computer is already using that port — another
running instance of this stack, or an unrelated application. Either stop
whatever's using it, or edit the port mapping for that service in
`docker-compose.yml` (the part before the colon in e.g. `"3000:3000"` is
the port on your computer; change just that side, e.g. `"3005:3000"`, and
adjust the URL you visit accordingly).

**I left `API_KEY`/`ADMIN_KEY` as the placeholder text and the stack
started anyway.**
That's expected — see the note in [Step 2](#3-step-2-clone-the-repo-and-configure-your-environment).
Compose only blocks startup if the variable is completely empty; it can't
tell a placeholder from a real secret. Go back and replace both values.

**Approving (or rejecting) an enrollment fails with `401` from curl, or the
Dashboard's Approve button shows "Unexpected Server Error" (`500`) — even
though every service in `docker compose ps` shows `(healthy)`.**
This is [lattice-hub#122](https://github.com/superbrobenji/lattice-hub/issues/122):
`ADMIN_KEY` isn't wired to the orchestrator container the way you'd expect,
in either mode this guide covers.
- **Stub mode**: the orchestrator only ever accepts the literal string
  `dev` for both `API_KEY` and `ADMIN_KEY`, regardless of `.env` — confirm
  you ran `export API_KEY=dev` and `export ADMIN_KEY=dev` *before* starting
  the stack, per [Step 3](#4-step-3-start-the-stack-and-verify-its-healthy).
  If you started it without exporting those first, stop the stack
  (`docker compose down`), export them now, and start it again — the
  Dashboard/Artist Portal containers pick up their keys at startup and
  won't self-correct from a plain `restart`.
- **Real-hardware mode**: the orchestrator container never receives
  `ADMIN_KEY` at all, so its admin-tier routes actually check the request
  against `API_KEY` instead. Fix: make sure `.env`'s `API_KEY` and
  `ADMIN_KEY` are set to the exact same value (per
  [Step 2](#3-step-2-clone-the-repo-and-configure-your-environment)), then
  `docker compose up -d` again so the Dashboard/Artist Portal containers
  pick up the corrected value.

Both of these are verified, working fixes for *today's* behavior, not just
a description of the bug — but they're workarounds. The real fix (passing
`ADMIN_KEY` through to the orchestrator, and not hardcoding stub keys) is
tracked in the linked issue; once that lands, `API_KEY` and `ADMIN_KEY` can
safely go back to being two different values.

**`docker compose ps` (or `logs`, or `restart`) fails with `required
variable API_KEY is missing a value`.**
This means the `.env` file in your current folder doesn't have a
usable `API_KEY`/`ADMIN_KEY` — either you're not running the command from
the `server` folder (Compose only auto-loads a `.env` file from the folder
you run it in), or the file is missing/incomplete. Re-check
[Step 2](#3-step-2-clone-the-repo-and-configure-your-environment).

## 7. What's next

- [`server/QUICK_START.md`](../server/QUICK_START.md) — a shorter,
  reference-style version of Steps 2–4 above, useful once you've done this
  once and just need a refresher.
- [`server/orchestrator/README.md`](../server/orchestrator/README.md) —
  full protocol/API reference and configuration options for the
  orchestrator service.
- [`server/dashboard/README.md`](../server/dashboard/README.md) —
  Dashboard-specific setup and development notes.
- [`README.md`](../README.md) — repository overview, architecture diagram,
  and how the end-to-end test suite works if you want to contribute code
  rather than just run the stack.
- [`lattice-nodes`](https://github.com/superbrobenji/lattice-nodes) and its
  [getting-started guide](https://github.com/superbrobenji/lattice-nodes/blob/main/docs/getting_started.md) —
  building and flashing the ESP32 firmware side of the system.
