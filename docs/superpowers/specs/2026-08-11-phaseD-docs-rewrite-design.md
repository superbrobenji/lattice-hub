# Phase D — Docs Rewrite Design (lattice-hub)

**Status:** Approved, ready for writing-plans.
**Date:** 2026-08-11
**Parent:** `lattice-nodes` umbrella spec, Phase D — cross-repo by design. This is the
`lattice-hub` leg, running in parallel with the `lattice-protocol` leg. `lattice-nodes`' own leg
is already merged (PR #102).

## Problem

Research (this session, grep-verified against current source at code-review rigor) found a tight
cluster of doc edits all dated 2026-07-16, followed by a dense run of undocumented
protocol/architecture changes after that point: protocol v4 flag-day (Jul 21), Phase H
hub-enrollment / master-keypair work (Aug 2), the `proto-sync` CI job (Aug 3), and protocol v5 /
JOIN_ACK wire shrink to lattice-protocol v0.6.0 (most recent commit). Concretely:

1. **Version/framework drift**: top-level and orchestrator READMEs say "Go 1.23+"; actual is Go
   1.25.0 (orchestrator) / 1.26.4 (sidecar). Dashboard and artist-portal READMEs say "React Router
   v7"; actual is v8.2.0, upgraded the same day those READMEs were last touched.
2. **A functionally broken quick-start**: `server/QUICK_START.md`'s "Enroll a Node" walkthrough
   requires `MASTER_MAC`/`MASTER_KEY_PATH` for `JOIN_ACK.OriginMacAddress` to be non-zero (firmware
   rejects enrollment otherwise) — these vars are undocumented anywhere and absent from
   `server/env.example`, so following the guide exactly against real firmware fails.
3. **A real code/docs mismatch**: docs describe a two-tier `API_KEY`/`ADMIN_KEY` auth model, but
   `docker-compose.yml` never passes `ADMIN_KEY` into the orchestrator container — the
   orchestrator's own admin routes silently fall back to the `API_KEY` tier. This is a code bug,
   not a doc bug; per this umbrella's established precedent (docs-only phases track code issues
   rather than fixing them inline — see lattice-nodes' pre-built-binary tracking issue), file a
   GitHub issue and document the *actual* current behavior with an explicit caveat, rather than
   describing the intended-but-unimplemented behavior or silently fixing the compose file.
4. **Missing env-var documentation**: `MASTER_KEY_PATH`, `MASTER_MAC`, `SECONDARY_MASTER_KEY_PATH`,
   `SECONDARY_MASTER_MAC` are all read by `main.go`/`envconfig.go` but absent from the orchestrator
   README's env-var table and from `env.example` — CONTRIBUTING's own checklist ("env.example
   updated if new environment variables added") was not followed for these.
5. **CI job table stale**: CONTRIBUTING lists 11 jobs, missing `proto-sync` (added Aug 3).
6. **OpenAPI spec stale**: missing `GET /api/v1/enrollments` (list-all) and
   `GET /api/v1/nodes/{id}/command/{commandId}`, both live and documented in the orchestrator
   README's own tables.
7. **A real wire-protocol documentation gap**: the orchestrator README covers static protocol
   facts (message types, opcodes) accurately, but the `ProtoVersion == 5` hard-enforcement/drop
   behavior, the enrollment handshake sequence (ENROLLMENT → JOIN_ACK → OP_NODE_ID_SET), the
   JOIN_ACK byte layout (dual-master fields, the v0.6.0 wire shrink), the 75s health-timeout
   constant, and hotswap/node-ID-reuse semantics are all implemented and commented in code but
   never surfaced in any doc.
8. **`server/sidecar/` has zero documentation** beyond a one-line description reused verbatim
   elsewhere — 6 real endpoints undocumented.
9. **No doc anywhere mentions `lattice-protocol` by name**, despite it being the sole source of
   every wire-format constant this server depends on and despite 6+ recent commits being entirely
   about tracking its breaking changes.

User also requested, on top of the fix-scope above: a full non-technical step-by-step setup guide
(mirroring lattice-nodes' `getting_started.md`), a full non-technical "how to use the hub" guide
(operating the dashboard and artist-portal, not developing against them), and a plain-language
breakdown of the public API for non-technical readers (distinct from the existing dev-facing
`api_examples.md`).

## Scope — 16 documents (9 fixes + 7 new)

| Doc | Action | Key content |
|---|---|---|
| `README.md` (top-level) | Fix | Go version badge/prereq corrected to match actual toolchains; add a brief, accurate ecosystem section covering both lattice-nodes (currently one sentence) and lattice-protocol (currently absent entirely) |
| `server/orchestrator/README.md` | Fix + extend | env-var table: add `MASTER_KEY_PATH`, `MASTER_MAC`, `SECONDARY_MASTER_KEY_PATH`, `SECONDARY_MASTER_MAC`; add `ProtoVersion == 5` enforcement + flag-day drop behavior; add JOIN_ACK wire layout (dual-master fields, v0.6.0 shrink); add the `ADMIN_KEY`-fallback caveat with a pointer to the tracked issue |
| `server/dashboard/README.md` | Fix | React Router v7 → v8.2.0 |
| `server/artist-portal/README.md` | Fix | React Router v7 → v8.2.0 |
| `CONTRIBUTING.md` | Fix | Add `proto-sync` to the CI job table |
| `server/orchestrator/openapi/v1.yaml` + artist-portal's duplicate copy | Fix | Add the 2 missing current paths (`GET /api/v1/enrollments`, `GET /api/v1/nodes/{id}/command/{commandId}`) to both copies identically |
| `server/QUICK_START.md` | Fix | Add the `MASTER_MAC`/`MASTER_KEY_PATH` setup step before the "Enroll a Node" walkthrough so it actually works against real firmware; standardize the quick-start's first example on `/api/v1/status` (current, public) rather than the legacy `/status` the top-level README shows, and note the legacy endpoint's status explicitly wherever it's still referenced |
| `server/env.example` | Fix | Add `MASTER_KEY_PATH`, `MASTER_MAC`, `SECONDARY_MASTER_KEY_PATH`, `SECONDARY_MASTER_MAC` with explanatory comments |
| `server/sidecar/README.md` | New | All 6 endpoints (`/sidecar/containers`, `.../{name}/restart|logs|stats|inspect`, `/sidecar/kafka/status`, `/sidecar/kafka/events/recent`, `/sidecar/services/health`), `ADMIN_KEY` gating |
| `docs/wire_protocol.md` | New | Deep hub-side wire-protocol doc: `ProtoVersion` enforcement, the enrollment handshake sequence, JOIN_ACK byte layout, dual-master fields, the 75s health-timeout constant (2.5× the 30s health interval), hotswap/node-ID-reuse semantics — cross-checked directly against `mesh/server.go` |
| `docs/ecosystem.md` | New | The 3-repo relationship from the hub's side: `lattice-protocol` dependency (currently mentioned in zero docs despite being pinned in `go.mod` and driving 6+ recent breaking-change commits), the "bump lattice-protocol → firmware must be reflashed → old nodes silently dropped by `ProtoVersion` check" flag-day relationship stated explicitly, brief accurate lattice-nodes overview |
| `docs/getting_started.md` | New | Full non-technical step-by-step setup guide: installing Docker/Docker Compose, cloning the repo, configuring `.env` (API_KEY/ADMIN_KEY/MASTER_MAC/MASTER_KEY_PATH generation — the real prerequisite this phase is also fixing into QUICK_START), `docker compose up`, verifying every service is healthy, connecting a first ESP32 master node, troubleshooting. Assumes zero prior Docker/backend-ops experience, every command shown verbatim |
| `docs/using_the_hub.md` | New | Full non-technical "how to use" guide: logging into the dashboard, monitoring nodes/zones, approving/rejecting enrollments, using the artist-portal (mesh map, zones, node commands, live events, embedded Swagger UI), reading status/health indicators — an end-user operating manual, zero code shown |
| `docs/api_guide.md` | New | Plain-language public API breakdown for non-technical readers: what each endpoint does in plain English, what each field means, a walked-through example request/response in prose — explicitly distinct in audience and style from the existing dev-facing `server/orchestrator/examples/api_examples.md`, which stays as-is |
| `docs/building_and_hosting_a_release.md` | New | **Establishes a new documented convention** — verified via source that this repo currently has zero git tags, no CI registry-push job (the `docker/setup-buildx-action` step in `ci.yml` is a local validation build, confirmed no `docker push`/`ghcr.io` step exists), and no versioning docs anywhere. Content: proposed semver git-tag convention mirroring `lattice-protocol`'s (tag + push, no GitHub Release/registry required); building production images locally via `docker compose -f docker-compose.yml build` (no registry push needed for the self-hosted target); **generic self-hosted Linux server** hosting — `docker compose up -d`, a systemd-unit example for restart-on-boot, a reverse-proxy/TLS pointer (e.g. Caddy or nginx in front of dashboard:3000 and artist-portal:3001), backup guidance for the JSON node/zone/auth registries and Kafka's data volume; **Raspberry Pi** hosting as its own subsection — arm64 compatibility confirmed via the actual base images in every `Dockerfile` (`golang:1.26-alpine`, `node:20-alpine`, `alpine:latest`, `python:3.9` all publish official arm64 manifests, so no Dockerfile changes needed), building natively on-device (Docker on an arm64 Pi builds arm64 images automatically, no cross-compilation setup required) as the recommended path over cross-building via buildx, and a memory-budget callout since Kafka is the stack's largest consumer (recommend Pi 4/5 with 4GB+ RAM; note the `docker-compose.stub.yml` hardware-free profile as a lighter-weight option for resource-constrained testing) |

**Explicitly deferred, tracked separately:** the `docker-compose.yml` `ADMIN_KEY`-not-passed-to-orchestrator
bug is a real code defect, not a doc defect — file a GitHub issue before this phase's PR opens,
and document the actual current fallback behavior (not the intended behavior) in
`server/orchestrator/README.md`'s auth section with a pointer to that issue.

## Approach

**No separate research phase** — this session's Explore-agent audit already verified every claim
above against current source (route registrations in `mesh/api.go`, env-var reads in `main.go`,
`docker-compose.yml`/`docker-compose.dev.yml`/`docker-compose.stub.yml` port and env mappings,
`go.mod` versions, `package.json` dependency versions, `.github/workflows/ci.yml` job list,
`mesh/server.go`'s serial-handling path end to end) at the same rigor Phase A's audit used. That
research is the input to the plan directly — no survey-agent wave needed before writing tasks.

## Review Standard

Same as `lattice-nodes`' Phase D: the bar is **accuracy against current source**, not prose
quality. Each doc's review must independently re-verify a sample of concrete claims (route paths
and auth tiers against `mesh/api.go`, env vars against `main.go`, port numbers against the compose
files, the OpenAPI additions against the actual handler signatures) rather than trusting the
research summary or the writer's confidence. `docs/getting_started.md` and `docs/using_the_hub.md`
additionally need a "could someone with zero prior Docker/ops experience actually follow this"
check, the same bar `lattice-nodes`' `getting_started.md` was held to — and ideally an actual
`docker compose up` walkthrough run against the stub stack (`docker-compose.stub.yml`, no hardware
required) to verify the setup guide's steps produce the described result, mirroring how
`lattice-nodes`' Phase D got a real `idf.py build` run rather than estimated numbers.

## Global Constraints

Docs-only phase, with one narrow exception already flagged: no fix to `docker-compose.yml`'s
`ADMIN_KEY` gap in this phase (track as an issue instead); no other code changes of any kind. No
wire-protocol changes. Every claim about a value (env var, port, route, endpoint path, timeout
constant) must be independently verified against source in this phase, not carried over from the
research summary without a spot-check. `docs/building_and_hosting_a_release.md` is the one
prescriptive (not corrective) doc in this phase's scope — it documents a *proposed* convention
for a process that doesn't exist yet in this repo, rather than fixing an existing wrong
description. Its claims about base-image architecture support and CI's actual current behavior
(build-only, no push) must still be verified against source, same as every other doc.

## Deliverable note

Before this phase's PR opens, file a GitHub issue tracking the `docker-compose.yml`
`ADMIN_KEY`-not-passed-to-orchestrator defect, referenced from `server/orchestrator/README.md`'s
auth section so readers know it's a known gap, not an oversight.
