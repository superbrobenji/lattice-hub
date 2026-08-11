# Phase D Docs Rewrite (lattice-hub) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 9 docs with confirmed drift (version numbers, a functionally broken quick-start, a
stale CI job list, a stale OpenAPI spec) and write 7 new docs (sidecar reference, wire-protocol
detail, ecosystem overview, 3 non-technical guides, a build/hosting guide), all verified against
current source. [lattice-hub#122](https://github.com/superbrobenji/lattice-hub/issues/122),
tracking the one real code defect found during research (`docker-compose.yml` never passes
`ADMIN_KEY` to the orchestrator), is already filed — Task 2 links to it.

**Architecture:** No code changes anywhere in this plan except the one narrow, explicitly-scoped
exception in Task 6 (`server/env.example` gets new variable entries — env.example is a template
file, not executable code). Every other task edits or creates only Markdown/YAML doc files. Each
task is independently verifiable against real source already surveyed in the design spec.

**Tech Stack:** Markdown docs, YAML (OpenAPI spec edits).

## Global Constraints

- Docs-only phase, with one exception: `server/env.example` (Task 6) gets new variable entries —
  this is template/example content, not executable code, and the spec explicitly scopes it in.
- No fix to `docker-compose.yml`'s `ADMIN_KEY`-not-passed-to-orchestrator gap anywhere in this
  plan — Task 14 files a GitHub issue for it instead. No other code changes of any kind.
- No wire-protocol changes.
- Every concrete claim (env var name, route path, port number, CI job name, timeout constant,
  framework version) must be independently verified against current source by the task's
  implementer — do not copy a claim from the design spec without spot-checking it, since the
  spec's research summary itself could contain a transcription error.
- `docs/building_and_hosting_a_release.md` (Task 13) is prescriptive, not corrective — it proposes
  a convention this repo doesn't have yet. Its infrastructure claims (base-image architectures,
  CI's actual current build-only behavior) still require source verification like every other doc.
- Cross-references between docs use relative Markdown links.

---

### Task 1: Fix top-level `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Fix the Go version badge/prereq**

Read `server/orchestrator/go.mod` and `server/sidecar/go.mod` for their actual `go` directive
versions (spec cites 1.25.0 and 1.26.4 — verify current). Update the README's "Go 1.23+" claim to
accurately reflect the real minimum (state it as "Go 1.25+ (orchestrator), 1.26+ (sidecar)" or
pick the accurate minimum-across-both phrasing — whichever the README's existing prose style
supports without becoming confusing).

- [ ] **Step 2: Add a brief, accurate ecosystem section**

The current README has exactly one sentence on `lattice-nodes` and nothing on `lattice-protocol`.
Add 3-5 sentences: this repo is the server-side counterpart to the `lattice-nodes` ESP32 firmware,
communicating over USB serial using the wire format defined in `lattice-protocol` (a direct Go
dependency — verify the exact pinned version by reading `server/orchestrator/go.mod`'s `require
github.com/superbrobenji/lattice-protocol` line). State the flag-day relationship in one sentence
(bumping `lattice-protocol` requires firmware to be reflashed, or old nodes get silently dropped
by the `ProtoVersion` check — verify this mechanism is still named `ProtoVersion` by grepping
`mesh/server.go`).

- [ ] **Step 3: Self-review and commit**

```bash
git add README.md
git commit -m "docs: fix Go version claim, add ecosystem section to top-level README"
```

---

### Task 2: Fix `server/orchestrator/README.md`

**Files:**
- Modify: `server/orchestrator/README.md`

**Interfaces:**
- Produces: the corrected env-var table and protocol-mechanics sections that
  `docs/getting_started.md` (Task 10) and `docs/wire_protocol.md` (Task 9) may cross-reference.

- [ ] **Step 1: Add the 4 missing env vars to the env-var table**

Read `main.go` / `envconfig.go` and confirm `MASTER_KEY_PATH`, `MASTER_MAC`,
`SECONDARY_MASTER_KEY_PATH`, `SECONDARY_MASTER_MAC` are read there (grep for each name to confirm
current variable names haven't drifted). Add all 4 to the existing env-var table, matching its
format (description, default if any, required/optional). Note in each row's description what
happens if unset (per `main.go`'s own warning message: `JOIN_ACK.OriginMacAddress` stays all-zero
and firmware rejects enrollment — quote the actual warning log line if one exists in source).

- [ ] **Step 2: Add `ProtoVersion` enforcement**

Read `mesh/server.go`'s `handleMessage` (or current equivalent function name — verify) for the
`if msg.ProtoVersion != 5 { ... }` check (verify the current required version number — a newer
protocol bump may have shipped since the spec's research). Add a short subsection stating this
enforcement exists, what value is currently required, and what happens to a message that fails
the check (silently dropped — verify this is still accurate, not e.g. logged-and-dropped or
rejected-with-error).

- [ ] **Step 3: Add JOIN_ACK wire layout**

Read `mesh/server.go`'s `ApproveEnrollment` (or current equivalent) for the JOIN_ACK payload byte
layout comment the spec cites (`data[0..4]=fingerprint, data[4..10]=secondaryMasterMac,
data[10..42]=secondaryPublicKey, data[42..64]=zero`) — verify these offsets and field names
directly from the current source comment, they may have shifted since a later commit. Add this as
a short table or annotated byte-layout diagram in the README, including the note about the v0.6.0
wire shrink (`SecondaryMasterMac`/`SecondaryPublicKey` top-level proto fields retired, moved into
this payload) if still accurate.

- [ ] **Step 4: Add the `ADMIN_KEY`-fallback caveat**

In the auth-model section, add an explicit callout: `docker-compose.yml` does not currently pass
`ADMIN_KEY` to the orchestrator container (verify by reading `docker-compose.yml`'s orchestrator
service `environment:` block directly — confirm `ADMIN_KEY` is genuinely absent there while
present on the other 3 services), so in the default compose setup the orchestrator's own admin
routes fall back to the `API_KEY` tier (verify this fallback behavior by reading how `ADMIN_KEY`
is checked in the relevant middleware/handler code). State this is tracked at
[lattice-hub#122](https://github.com/superbrobenji/lattice-hub/issues/122).

- [ ] **Step 5: Self-review and commit**

```bash
git add server/orchestrator/README.md
git commit -m "docs: fix orchestrator README env-var table gap, add ProtoVersion/JOIN_ACK/ADMIN_KEY-fallback detail"
```

---

### Task 3: Fix `server/dashboard/README.md` and `server/artist-portal/README.md`

**Files:**
- Modify: `server/dashboard/README.md`
- Modify: `server/artist-portal/README.md`

- [ ] **Step 1: Verify and fix the React Router version claim**

Read `server/dashboard/package.json` and `server/artist-portal/package.json` for the actual
`react-router` (or `@react-router/*`) dependency version (spec cites v8.2.0 — verify current,
since a dependency bump may have shipped since). Fix both READMEs' "React Router v7" claim to the
verified current version.

- [ ] **Step 2: Self-review and commit**

```bash
git add server/dashboard/README.md server/artist-portal/README.md
git commit -m "docs: fix stale React Router version claim in dashboard and artist-portal READMEs"
```

---

### Task 4: Fix `CONTRIBUTING.md`

**Files:**
- Modify: `CONTRIBUTING.md`

- [ ] **Step 1: Add the missing CI job to the job table**

Read `.github/workflows/ci.yml` and list every current job name (spec cites 11 existing +
`proto-sync` missing — verify the full current list, a job may have been added or removed since).
Add any job present in `ci.yml` but absent from `CONTRIBUTING.md`'s table, matching its existing
format (job name, what it checks).

- [ ] **Step 2: Self-review and commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs: add missing proto-sync CI job to CONTRIBUTING's job table"
```

---

### Task 5: Fix OpenAPI specs

**Files:**
- Modify: `server/orchestrator/openapi/v1.yaml`
- Modify: `server/artist-portal/public/openapi/v1.yaml`

**Interfaces:**
- Consumes: the actual handler signatures in `mesh/api_v1_*.go` for the 2 missing paths.

- [ ] **Step 1: Verify the 2 missing paths against live handler code**

Read the handler for `GET /api/v1/enrollments` (list-all, as opposed to the already-documented
pending-only endpoint) and `GET /api/v1/nodes/{id}/command/{commandId}` (command-ack polling) in
`mesh/api_v1_*.go`. For each, determine the exact request parameters, response schema (fields and
types), and status codes returned, matching the OpenAPI spec's existing style for documented
endpoints (look at a neighboring already-documented path as a template).

- [ ] **Step 2: Add both paths to both YAML files identically**

`server/orchestrator/openapi/v1.yaml` and `server/artist-portal/public/openapi/v1.yaml` are
described as byte-identical duplicates in the spec — verify this with `diff` before editing, then
apply the identical addition to both so they stay in sync. If a `diff` shows they've already
drifted apart for unrelated reasons, note this in the task report as a concern but still add the
2 paths to both without otherwise reconciling unrelated drift (out of scope for this task).

- [ ] **Step 3: Validate the YAML**

Confirm both files remain valid YAML (a linter if available, or careful manual indentation check)
and valid OpenAPI structure (the new path entries follow the same nesting as existing ones).

- [ ] **Step 4: Self-review and commit**

```bash
git add server/orchestrator/openapi/v1.yaml server/artist-portal/public/openapi/v1.yaml
git commit -m "docs: add 2 missing current paths to both OpenAPI v1 spec copies"
```

---

### Task 6: Fix `server/QUICK_START.md` and `server/env.example`

**Files:**
- Modify: `server/QUICK_START.md`
- Modify: `server/env.example`

**Interfaces:**
- Consumes: the same 4 env vars Task 2 documents in the orchestrator README (`MASTER_KEY_PATH`,
  `MASTER_MAC`, `SECONDARY_MASTER_KEY_PATH`, `SECONDARY_MASTER_MAC`) — verify independently here
  too rather than trusting Task 2's output, since tasks run independently and may execute in
  parallel with no guaranteed ordering.

- [ ] **Step 1: Add the missing env vars to `env.example`**

Read `main.go`/`envconfig.go` to confirm the 4 variable names, then add them to
`server/env.example` with a one-line explanatory comment each (what they're for, and that
enrollment will fail without them — matching the file's existing comment style for other vars).

- [ ] **Step 2: Add the master-identity setup step to QUICK_START's enrollment walkthrough**

Before the "Enroll a Node" section, add a step explaining `MASTER_MAC`/`MASTER_KEY_PATH` must be
set for enrollment to succeed against real firmware (cite the actual consequence: `JOIN_ACK`'s
origin MAC stays zero and firmware rejects the enrollment). Show how to obtain/generate these
values if that's documented anywhere else in the repo (check `mesh/` for a keypair-generation
script or command); if no such tooling exists yet, describe the manual step accurately without
inventing tooling that isn't there.

- [ ] **Step 3: Standardize on the v1 status endpoint**

QUICK_START.md's own example already uses `/api/v1/status` — verify this is still true. If the
top-level README's example (which the spec found uses the legacy `/status`) is inconsistent with
this, that's Task 1's concern, not this task's — this task only needs to confirm QUICK_START
itself is internally consistent and, if it references the legacy endpoint anywhere, add a
one-line note that it's the legacy/deprecated path.

- [ ] **Step 4: Self-review and commit**

```bash
git add server/QUICK_START.md server/env.example
git commit -m "docs: document MASTER_MAC/MASTER_KEY_PATH prerequisite so enrollment quick-start actually works"
```

---

### Task 7: New `server/sidecar/README.md`

**Files:**
- Create: `server/sidecar/README.md`

- [ ] **Step 1: Read the sidecar source directly**

Read `server/sidecar/`'s route registration (main.go or router setup file) for all 6 endpoints
the spec cites (`/sidecar/containers`, `/sidecar/containers/{name}/restart|logs|stats|inspect`,
`/sidecar/kafka/status`, `/sidecar/kafka/events/recent`, `/sidecar/services/health`) — verify the
exact current path list, request/response shapes, and confirm the `ADMIN_KEY` gating by reading
the middleware applied to these routes.

- [ ] **Step 2: Write the README**

Follow the structural pattern of `server/orchestrator/README.md` or another service README in
this repo (env vars if any, endpoint table with method/path/auth-tier/description, a couple of
example curl commands per the pattern in `server/orchestrator/examples/api_examples.md`).

- [ ] **Step 3: Self-review and commit**

```bash
git add server/sidecar/README.md
git commit -m "docs: add sidecar service README (previously undocumented)"
```

---

### Task 8: New `docs/wire_protocol.md`

**Files:**
- Create: `docs/wire_protocol.md`

**Interfaces:**
- Consumes: none (deeper version of the summary Task 2 adds to the orchestrator README).

- [ ] **Step 1: Read `mesh/server.go` end to end for the serial-handling path**

Read `handleMessage`, `handleAdapterData`, `handleSerialData`, `handleEnrollmentRequest`,
`ApproveEnrollment`, `RejectEnrollment` (verify these function names are still current) in full.

- [ ] **Step 2: Write the deep wire-protocol doc**

Cover, each cross-checked directly against the code read in Step 1: `ProtoVersion` enforcement and
drop behavior (deeper than Task 2's README summary — include the actual code path, not just the
fact); the enrollment handshake sequence (ENROLLMENT → JOIN_ACK → OP_NODE_ID_SET, verify this
exact ordering from the handler logic, not assumed); the JOIN_ACK byte layout (same content as
Task 2's README addition, but this is the canonical detailed version — Task 2's README section can
stay a summary that links here once this doc exists); the health-report timeout constant (spec
says 75s = 2.5× the 30s health interval — verify both numbers directly in `api.go`'s status
handler or wherever the online/offline determination lives); hotswap/node-ID-reuse semantics in
`ApproveEnrollment` (describe what happens if a MAC re-enrolls with a previously-used node ID).

- [ ] **Step 3: Self-review and commit**

```bash
git add docs/wire_protocol.md
git commit -m "docs: add deep hub-side wire-protocol doc (ProtoVersion, enrollment handshake, JOIN_ACK layout)"
```

---

### Task 9: New `docs/ecosystem.md`

**Files:**
- Create: `docs/ecosystem.md`

- [ ] **Step 1: Write the 3-repo relationship from the hub's side**

State the `lattice-protocol` dependency explicitly (verify the pinned version from
`server/orchestrator/go.mod`), and that this doc exists because the spec's research found *zero*
docs in this repo mention `lattice-protocol` by name despite 6+ recent commits being entirely
about tracking its breaking changes (verify this claim is still true with a repo-wide grep for
`lattice-protocol` across `.md` files before asserting it — if a doc now mentions it, don't claim
otherwise).

- [ ] **Step 2: State the flag-day relationship explicitly**

"Bump lattice-protocol → firmware must be reflashed → old nodes are silently dropped by the
`ProtoVersion` check" — write this out as explicit operational guidance for whoever maintains this
repo's dependency bumps, cross-referencing `docs/wire_protocol.md` (Task 8) for the mechanism.

- [ ] **Step 3: Add a brief, accurate lattice-nodes overview**

3-5 sentences: what lattice-nodes is (ESP32 mesh firmware), how it connects to this repo (USB
serial to the orchestrator), and a pointer to lattice-nodes' own docs if you have read access to
verify the link target exists (check `/Users/benji/projects/personal/lattice-nodes` on this
machine).

- [ ] **Step 4: Self-review and commit**

```bash
git add docs/ecosystem.md
git commit -m "docs: add 3-repo ecosystem doc from lattice-hub's perspective"
```

---

### Task 10: New `docs/getting_started.md`

**Files:**
- Create: `docs/getting_started.md`

**Interfaces:**
- Consumes: the env-var list from Task 6 (`MASTER_KEY_PATH`, `MASTER_MAC`,
  `SECONDARY_MASTER_KEY_PATH`, `SECONDARY_MASTER_MAC`, `API_KEY`, `ADMIN_KEY`) — verify
  independently from `main.go`/`env.example` rather than trusting Task 6's output.

- [ ] **Step 1: Write the Docker/Compose install section**

Zero prior Docker experience assumed. Platform-specific install instructions (macOS/Linux/Windows)
for Docker Desktop or Docker Engine + Compose plugin, with a verification command
(`docker compose version`) and expected output shown.

- [ ] **Step 2: Write the clone + configure section**

`git clone`, `cd server`, copying `env.example` to `.env`, and walking through every required
variable (`API_KEY`, `ADMIN_KEY`, and — the real prerequisite this phase is fixing in — `MASTER_MAC`/
`MASTER_KEY_PATH`) with concrete guidance on generating a value for each (not just "set this").

- [ ] **Step 3: Write the run + verify section**

The exact `docker compose up -d` command, how to check every service is healthy (`docker compose
ps`, expected `healthy` status per service — cross-check against each Dockerfile's `HEALTHCHECK`
directive read directly), and what each service's URL/port is for a first visual check
(dashboard at `:3000`, artist-portal at `:3001`, orchestrator `:8080/health`).

- [ ] **Step 4: Write the "connect a first ESP32 master node" section**

What the reader should see (serial connection, the node publishing its pubkey per lattice-nodes'
own provisioning flow if cross-referenceable) and how to confirm the hub sees it (which API
endpoint or dashboard view shows a newly-connected but unenrolled node).

- [ ] **Step 5: Write troubleshooting**

Common failure modes worth covering: a service failing its healthcheck (what log to check), the
enrollment-fails-silently symptom this phase's research found (missing `MASTER_MAC`), a port
already in use.

- [ ] **Step 6: If feasible, actually run it against the stub stack to verify**

`docker-compose.stub.yml` provides a hardware-free path (swaps serial for `tcp://mesh-sim`) — if
Docker is available in your environment, actually run `docker compose -f docker-compose.yml -f
docker-compose.stub.yml up -d` and confirm the steps you wrote produce the described result. If
Docker isn't available in your execution environment, note this limitation clearly in your task
report rather than silently skipping verification — the final review should independently attempt
this run.

- [ ] **Step 7: Self-review and commit**

```bash
git add docs/getting_started.md
git commit -m "docs: add non-technical step-by-step setup guide"
```

---

### Task 11: New `docs/using_the_hub.md`

**Files:**
- Create: `docs/using_the_hub.md`

- [ ] **Step 1: Read the dashboard and artist-portal source for their real current feature set**

Read `server/dashboard/app/` and `server/artist-portal/app/` route/page structure (not from
memory — the spec's research already mapped this, but this task needs the actual current UI
flows: what pages exist, what actions each page offers) to ensure the guide describes real,
current UI rather than an assumed one.

- [ ] **Step 2: Write the dashboard usage section**

Zero code shown. Logging in (cookie session against `ADMIN_KEY` — describe as "enter the admin
key you configured during setup"), monitoring nodes/zones (what the list/detail views show),
approving/rejecting enrollments (the actual UI flow — button labels, confirmation steps if any,
what fields you fill in), infra/sidecar views if the dashboard exposes them (verify from source).

- [ ] **Step 3: Write the artist-portal usage section**

The mesh map (React Flow + dagre — describe what a reader sees and how to interact, not the
implementation), zones, node commands (what commands are available and what they do in plain
terms), live events (SSE — describe as "updates automatically" without the acronym unless
explained), the embedded Swagger UI if present (a pointer to it, not a duplicate of Task 12's
content).

- [ ] **Step 4: Write status/health indicator meanings**

What online/offline/degraded (or whatever states actually exist in the UI — verify from source)
mean, and roughly when they change (cross-reference the 75s health-timeout constant from Task 8's
doc rather than re-deriving it).

- [ ] **Step 5: Self-review and commit**

```bash
git add docs/using_the_hub.md
git commit -m "docs: add non-technical hub usage guide (dashboard + artist-portal)"
```

---

### Task 12: New `docs/api_guide.md`

**Files:**
- Create: `docs/api_guide.md`

**Interfaces:**
- Consumes: the actual route list in `mesh/api.go` and `mesh/api_v1_*.go` — read directly, do not
  copy from `server/orchestrator/README.md`'s dev-facing tables without verifying independently.

- [ ] **Step 1: Select the public-facing endpoint set to cover**

Focus on the `/api/v1/*` public and admin endpoints most relevant to a non-technical reader (status,
nodes, enrollments, events) rather than exhaustively documenting every internal/legacy route —
this doc's job is plain-language orientation, not a complete reference (that's what the OpenAPI
spec and `api_examples.md` are for).

- [ ] **Step 2: Write each endpoint in plain language**

For each selected endpoint: what it does in one plain-English sentence (no HTTP jargon beyond
"you visit this address" framing), what the response tells you in plain terms (avoid raw JSON
field names where a plain description suffices, but do show one real example
request/response pair per endpoint so a technical reader isn't left guessing either), and when
you'd actually want to use it.

- [ ] **Step 3: Self-review and commit**

Confirm every example request/response shown was verified against the actual handler (not
invented), and that this doc's tone and audience are visibly distinct from
`server/orchestrator/examples/api_examples.md` (that file stays unchanged and dev-facing).

```bash
git add docs/api_guide.md
git commit -m "docs: add plain-language public API guide for non-technical readers"
```

---

### Task 13: New `docs/building_and_hosting_a_release.md`

**Files:**
- Create: `docs/building_and_hosting_a_release.md`

- [ ] **Step 1: Verify the greenfield premise before writing**

Run `git tag` (confirm still empty — no existing releases). Confirm no `docker push`/`ghcr.io`
step exists in `.github/workflows/ci.yml` (the `docker/setup-buildx-action` step is build-only —
verify by reading the full job it's part of, confirm no push step follows it). Read every
`Dockerfile` under `server/*/Dockerfile*` and confirm the base images (`golang:1.26-alpine`,
`node:20-alpine`, `alpine:latest`, `python:3.9`) — verify these are still the current base images,
a dependency bump may have changed them since the spec was written.

- [ ] **Step 2: Write the proposed versioning convention**

Propose git-tag semver (`vX.Y.Z`), explicitly noting this repo has no prior convention to follow
(unlike `lattice-protocol`, which this doc can reference as the sibling repo's existing pattern to
mirror, if you have read access to verify `lattice-protocol` uses this pattern —
`/Users/benji/projects/personal/lattice-protocol` is a sibling directory on this machine).

- [ ] **Step 3: Write the production build section**

`docker compose -f docker-compose.yml build` (verify this is the correct invocation for a
production-only build, i.e. confirm it doesn't also try to build the dev-only Jupyter overlay
service, which lives in `docker-compose.dev.yml` — should be fine since `build:` directives are
only in the base compose file per the earlier grep, but verify). No registry push needed since the
target is self-hosted/build-on-device.

- [ ] **Step 4: Write the generic self-hosted server hosting section**

`docker compose up -d` in production mode, a systemd unit example that runs `docker compose up
-d` on boot and `docker compose down` on stop (write a real, syntactically valid unit file), a
reverse-proxy/TLS pointer (a minimal Caddy or nginx example fronting `dashboard:3000` and
`artist-portal:3001` with TLS termination — pick one tool and be concrete, don't hand-wave), and
backup guidance for the JSON node/zone/auth registries (identify their actual file paths from
`main.go`'s registry-path env vars or defaults) and Kafka's data volume (identify the actual
volume name/mount from `docker-compose.yml`).

- [ ] **Step 5: Write the Raspberry Pi hosting section**

State the arm64-compatibility verification from Step 1 plainly (every base image publishes an
official arm64 manifest — cite this as a checked fact, e.g. "confirmed via Docker Hub" if you can
verify it, or phrase as "these are all official multi-architecture images" if you're confident
from general knowledge but didn't independently hit the registry — be honest about which). Explain
building natively on-device is the recommended path (Docker on an arm64 host builds arm64 images
automatically, no buildx/cross-compilation config needed) versus cross-building from an amd64 dev
machine via `docker buildx build --platform linux/arm64` (mention as an alternative, not the
primary path). Add the memory-budget callout: Kafka is the stack's heaviest service (state actual
memory behavior if determinable from `docker-compose.yml`'s resource limits, if any are set — if
none are set, say so and recommend a Pi with 4GB+ RAM as a practical minimum), and mention
`docker-compose.stub.yml`'s hardware-free profile as a lighter-weight option for resource-constrained
testing/development on a Pi (verify what "lighter-weight" actually means here — does the stub
profile actually drop Kafka or any other heavy service, or just swap the serial transport? Check
before claiming a memory benefit that may not be real).

- [ ] **Step 6: Self-review and commit**

```bash
git add docs/building_and_hosting_a_release.md
git commit -m "docs: add build/hosting guide (generic self-hosted server + Raspberry Pi)"
```

---

## GitHub Issue (already filed)

[lattice-hub#122](https://github.com/superbrobenji/lattice-hub/issues/122) — `docker-compose.yml`
never passes `ADMIN_KEY` to the orchestrator container — filed by the controller before task
dispatch, per this umbrella's established precedent of filing tracking issues up front rather than
mid-plan. No task needs to file it; Task 2 links to it directly.
