<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Building and Hosting a Release

This document is different from the rest of `docs/`: it doesn't describe an existing process, it
**proposes** one. As of this writing, `lattice-hub` has:

- **Zero git tags** (`git tag` returns nothing) — no version has ever been cut.
- **No release CI job** — `.github/workflows/ci.yml`'s `docker-build` job runs
  `docker/setup-buildx-action` purely to enable multi-stage/cache-efficient local builds for
  validation; it runs `docker compose build` and a stub-profile build of `mesh-sim`, and stops
  there. There is no `docker push`, no `ghcr.io` login, and no step after the build that publishes
  an image anywhere.
- **No versioning docs anywhere else in this repo.**

Everything below is a recommended convention, not a description of something already in place.
It's written to require no new CI, no container registry, and no GitHub Release automation —
just git tags and a `docker compose build` run on the host that will run the stack.

## Versioning convention

Use annotated git tags in `vX.Y.Z` semver form (`v1.0.0`, `v1.1.0`, `v1.1.1`, ...), applied to the
whole repo as one unit — there's no infrastructure today for versioning `server/orchestrator`,
`server/dashboard`, `server/artist-portal`, and `server/sidecar` independently (no per-service
`version` field, no per-service changelogs), and all four are already built and deployed together
via the single `server/docker-compose.yml`. A tag simply marks "this commit is a known-good
release point" for `git checkout vX.Y.Z && docker compose build` — it does not trigger any
automation.

```bash
git tag -a v1.0.0 -m "v1.0.0: <one-line summary of what changed>"
git push origin v1.0.0
```

This mirrors the sibling `lattice-protocol` repo's existing convention, which was verified
directly rather than assumed: `lattice-protocol` has 9 tags today (`v0.1.0` through `v0.6.0`,
confirmed via both `git tag` in a local clone and `gh api repos/superbrobenji/lattice-protocol/tags`
against the GitHub API), each an annotated tag with a descriptive message (e.g. `v0.6.0: protocol
v5 wire shrink 250→200B (Phase G)`), pushed to `origin`. `gh release list` against that repo returns
no entries — so the pattern is plain annotated tags, not GitHub Releases, and there's no
`CHANGELOG.md` file either (checked: absent from the repo root alongside `README.md`,
`CONTRIBUTING.md`, etc.). The tag itself is load-bearing, not cosmetic: `lattice-hub`'s own
`server/orchestrator/go.mod` pins `github.com/superbrobenji/lattice-protocol v0.6.0`, which only
resolves because that tag exists on the remote. `lattice-hub` has no equivalent Go-module consumer
of its own tags, so the convention here is purely a human-readable release marker — but it's the
same low-ceremony shape, and it's worth staying consistent with the pattern the ecosystem's other
repo already uses.

## Building for production

```bash
cd server
docker compose -f docker-compose.yml build
```

This builds exactly the four services that have a `build:` directive in `docker-compose.yml` —
`orchestrator`, `dashboard`, `artist-portal`, `sidecar` (confirmed by reading the full file: those
are the only four `build:` stanzas in it). It does **not** pull in the dev-only `jupyter` service,
which lives entirely in `docker-compose.dev.yml` and isn't loaded unless that file is passed with
an extra `-f`. It also does not build `mesh-sim`, which only exists as a service in
`docker-compose.stub.yml`. `kafka` isn't built at all — `docker-compose.yml` pulls it as a
prebuilt image (`apache/kafka:3.7.0`).

One easy-to-miss requirement: even though `API_KEY` and `ADMIN_KEY` are runtime secrets, Compose
resolves every `${VAR:?...}` substitution in the file — including ones in `environment:` blocks —
just to parse it, and `build` is not exempt. Without both set, `docker compose build` fails before
it builds anything. This isn't a guess: CI's own `docker-build` job sets
`API_KEY: ci-placeholder` / `ADMIN_KEY: ci-placeholder` immediately before running `docker compose
build`, specifically to satisfy this. In practice, populate `server/.env` from `env.example` (see
`server/QUICK_START.md`) before building — real values aren't required yet at build time, only
present ones.

No registry push step is needed or provided here. The target for this doc is
self-hosted/build-on-device: build the images on the machine (or Pi) that will run them, and skip
registry hosting entirely.

## Hosting: generic self-hosted server

### Running in production mode

```bash
cd server
docker compose -f docker-compose.yml up -d
```

This is the same invocation `server/QUICK_START.md` and the top-level `README.md` already document
for local use — for a persistent host, the only difference is running it as a supervised service
rather than from an interactive shell (below), and putting a reverse proxy with TLS in front of it
(also below).

### Run on boot with systemd

A `Type=oneshot` unit with `RemainAfterExit=yes` maps cleanly onto `docker compose up -d` /
`docker compose down`, since Compose itself detaches and manages the containers — there's no
long-running foreground process for systemd to supervise directly. Adjust `WorkingDirectory` to
wherever the repo is cloned, and confirm `docker`'s path with `which docker` on the target host
(`/usr/bin/docker` is typical on Debian/Raspberry Pi OS but not guaranteed everywhere).

```ini
# /etc/systemd/system/lattice-hub.service
[Unit]
Description=Lattice Hub (docker compose stack)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/lattice-hub/server
ExecStart=/usr/bin/docker compose -f docker-compose.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now lattice-hub.service
```

Compose reads `server/.env` from the working directory automatically, so no `EnvironmentFile=`
directive is needed as long as `WorkingDirectory` points at `server/` and `.env` lives there.

### Reverse proxy and TLS

The two services meant for browsers are `dashboard` (port `3000`) and `artist-portal` (port
`3001`); neither container terminates TLS itself. [Caddy](https://caddyserver.com/) is a
reasonable default here — it gets automatic Let's Encrypt certificates from a Caddyfile this
short, no separate certbot setup:

```caddyfile
# /etc/caddy/Caddyfile
dashboard.example.com {
    reverse_proxy localhost:3000
}

portal.example.com {
    reverse_proxy localhost:3001
}
```

Point both DNS names at the host, install Caddy, drop this in as `/etc/caddy/Caddyfile`, and
restart the `caddy` service — it obtains and renews certificates on its own. If the orchestrator's
API (`8080`) or the sidecar (`9000`) also need to be reachable from outside the host, add matching
blocks the same way; neither is required for the dashboard/artist-portal UIs to work over HTTPS.

### Backup guidance

**JSON registries.** The orchestrator persists its node/zone/auth registries and master identity
keypair as JSON files, all under a single directory:

| Env var | Default (from `env.example` / `main.go`) |
|---|---|
| `NODE_REGISTRY_PATH` | `data/nodes.json` |
| `ZONE_REGISTRY_PATH` | `data/zones.json` |
| `AUTH_REGISTRY_PATH` | `data/nodeauth.json` |
| `MASTER_KEY_PATH` | `data/masterkey.json` |
| `SECONDARY_MASTER_KEY_PATH` (dual-master only) | `data/masterkey-secondary.json` |

All of these paths are relative to the orchestrator's working directory (`/app` inside the
container, per `server/orchestrator/Dockerfile`'s `WORKDIR /app`), and `docker-compose.yml` mounts
a single named volume there: `orchestrator_data:/app/data`. So one volume backup covers all of
them. Note `MASTER_KEY_PATH` in particular: the orchestrator auto-generates a fresh keypair there
if the file is missing (documented in `server/QUICK_START.md`), which means losing this volume
without a backup doesn't fail loudly — it silently produces a new master identity on next start.
Back up the volume, e.g.:

```bash
docker run --rm \
  -v orchestrator_data:/data \
  -v "$(pwd)":/backup \
  alpine tar czf "/backup/orchestrator-data-$(date +%F).tar.gz" -C /data .
```

**Kafka.** Checked directly: `docker-compose.yml`'s top-level `volumes:` block declares only
`orchestrator_data`. The `kafka` service has no `volumes:` entry at all — no named volume is
mounted for it in this repo's Compose setup today. Practically, that means Kafka's `motion-trigger`
and `mesh-messages` topic data is not guaranteed to survive container recreation (`docker compose
down` followed by `docker compose up`, or an image change) — at best it persists for the life of
the current container. If retaining Kafka's event history matters for a given deployment, that's
worth adding explicitly (a named volume mounted at Kafka's data directory — commonly
`/var/lib/kafka/data` for this image per community documentation, though that default wasn't
independently confirmed against this exact `apache/kafka:3.7.0` tag's internals) before relying on
it in production; this doc doesn't make that change since it's docs-only.

## Hosting: Raspberry Pi

### Architecture compatibility

Every base image this stack currently uses was checked directly against the registry (via the
Docker Hub v2 API) rather than assumed, on 2026-08-11:

| Image | linux/arm64 manifest present |
|---|---|
| `golang:1.26-alpine` (orchestrator, sidecar, mesh-sim builder stages) | Yes — confirmed via Docker Hub API |
| `node:20-alpine` (dashboard, artist-portal) | Yes — confirmed via Docker Hub API |
| `alpine:latest` (orchestrator, sidecar, mesh-sim runtime stages) | Yes — confirmed via Docker Hub API |
| `apache/kafka:3.7.0` | Yes — confirmed via Docker Hub API (amd64 + arm64 images listed for this tag) |
| `python:3.9` (`server/logging/Dockerfile`) | Yes — confirmed via Docker Hub API |

The `python:3.9` entry is included for completeness (it's a `Dockerfile` under `server/`), but
note it isn't currently wired into `docker-compose.yml` as a buildable service — the dev-only
Jupyter service in `docker-compose.dev.yml` uses the prebuilt `jupyter/scipy-notebook:latest`
image directly rather than building `server/logging/Dockerfile`. It's unused by the Compose stack
today regardless of architecture.

No Dockerfile changes are needed for arm64: all five images used by the production Compose stack
publish official arm64 manifests.

### Recommended path: build natively on the Pi

Docker on an arm64 host (Raspberry Pi OS 64-bit, or another arm64 Linux distro) builds arm64
images automatically when you run a normal `docker compose build` — the daemon targets its own
host architecture by default, no `buildx`/cross-compilation configuration required. This is the
recommended path: clone the repo onto the Pi, follow the "Building for production" and "Running in
production mode" sections above exactly as written.

**Alternative: cross-build from an amd64 dev machine.** If you'd rather build on a faster amd64
machine and transfer images to the Pi, `docker buildx` can cross-compile:

```bash
docker buildx build --platform linux/arm64 -t lattice-orchestrator:latest ./orchestrator
```

repeated per service, then transferred to the Pi (`docker save` / `docker load`, or a registry).
This is slower to set up than building natively and isn't necessary unless Pi-side build time is
itself a problem — mentioned here as an option, not the primary recommendation.

### Memory budget

`docker-compose.yml` sets no memory or CPU limits on any service — checked directly (no
`mem_limit`, `deploy.resources`, or `cpus` keys anywhere in `docker-compose.yml`,
`docker-compose.dev.yml`, `docker-compose.stub.yml`, or `docker-compose.stub.seed.yml`). Every
service runs with whatever the host has available.

Kafka is the heaviest service in the stack — it's a JVM process, and this Compose setup doesn't
override its default heap sizing (no `KAFKA_HEAP_OPTS` or equivalent is set). This wasn't measured
against real hardware as part of writing this doc (no numbers here are benchmarked); as a practical
starting point, a Raspberry Pi 4 or 5 with **4GB of RAM or more** is a reasonable minimum for
running the full stack (`kafka` + `orchestrator` + `dashboard` + `artist-portal` + `sidecar`)
without tuning. A 1–2GB Pi is not recommended without reducing Kafka's memory footprint yourself
(e.g. via `KAFKA_HEAP_OPTS`), which this doc doesn't walk through.

**`docker-compose.stub.yml` is not a lighter-weight profile for this purpose.** It's tempting to
reach for it here, but checking what it actually overrides shows it doesn't reduce the stack's
resource footprint: it swaps the orchestrator's serial transport from a real USB device to a
`mesh-sim` container speaking the same protocol over TCP, so the stack can run without ESP32
hardware attached. `kafka` is untouched — it's inherited as-is from `docker-compose.yml`, no
lighter alternative, no resource limits added. Use the stub profile on a Pi for its actual purpose
(developing/testing the dashboard and artist-portal without a physical mesh master attached), not
as a way to fit the stack into less RAM.
