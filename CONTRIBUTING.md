<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Contributing to Lattice Motion Sensor Server

All contributions must pass the CI pipeline before merge. The pipeline enforces
build correctness, type safety, linting, and security scanning automatically.

## Before opening a PR

- [ ] `go test ./...` passes in `server/orchestrator/` and `server/sidecar/`
- [ ] `go vet ./...` clean in `server/orchestrator/` and `server/sidecar/`
- [ ] `gofmt -l .` returns no files in `server/orchestrator/` and `server/sidecar/`
- [ ] `npm run typecheck` passes in `server/dashboard/` and `server/artist-portal/`
- [ ] `npm run lint` clean in `server/dashboard/` and `server/artist-portal/`
- [ ] `npm run test` passes in `server/artist-portal/`
- [ ] `make e2e` passes (Playwright suite against the stub stack)
- [ ] `docker compose build` succeeds in `server/`
- [ ] `env.example` updated if new environment variables added
- [ ] Documentation updated if behaviour changes

## Branch naming

```
feature/<topic>      # new features
fix/<bug>            # bug fixes
refactor/<area>      # structural changes
docs/<topic>         # documentation only
ci/<topic>           # CI/tooling changes
```

## Commit style

- Imperative present-tense subject: "Add health endpoint", "Fix serial timeout"
- 72-character limit on subject line
- Body optional; use it to explain *why*, not *what*

## Go standards

- `gofmt` is canonical — run before every commit
- `go vet` must produce no output
- Tests live alongside the code they test (`*_test.go`)
- New behaviour requires a test

## TypeScript standards

- `tsc --noEmit` (via `npm run typecheck`) must pass — no type errors
- Linting (`npm run lint`) must be clean — the dashboard uses ESLint, the
  artist portal uses oxlint
- Strict mode is enabled — no `any` casts without justification

## Docker

- All Dockerfiles (`orchestrator`, `dashboard`, `artist-portal`, `sidecar`,
  `logging`, plus `orchestrator/Dockerfile.mesh-sim`) must build without error
- If you change environment variables, update `server/env.example`

## CI pipeline (GitHub Actions)

The workflow runs on every push to `main`/`develop` and on all PRs to `main`.
All jobs must be green before a PR can merge:

| Job | What it checks |
|-----|----------------|
| `go-test` | `go test ./...` + `go vet ./...` (orchestrator) |
| `go-lint` | golangci-lint default ruleset (orchestrator) |
| `sidecar-test` | `go test ./...` + `go vet ./...` (sidecar) |
| `sidecar-lint` | golangci-lint default ruleset (sidecar) |
| `ts-build` | TypeScript strict typecheck (dashboard) |
| `ts-lint` | ESLint (dashboard) |
| `dashboard-build` | Production build (dashboard) |
| `artist-portal-build` | Production build (artist portal) |
| `artist-portal-lint` | oxlint (artist portal) |
| `docker-build` | `docker compose build` + mesh-sim image build |
| `e2e` | Playwright end-to-end suite against the stub stack |

CodeQL security analysis and dependency vulnerability review run separately and
are also required to pass.

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md).
Enforcement contact is in [SECURITY.md](SECURITY.md).
