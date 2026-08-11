<!-- SPDX-License-Identifier: GPL-3.0-or-later -->

# Ecosystem: the three-repo relationship, from `lattice-hub`'s side

`lattice-hub` is one of three sibling repos that together make up the Lattice system:

- **`lattice-hub`** (this repo) — the Go server. `server/orchestrator` owns the USB-serial
  connection to the mesh's master node, decodes/encodes the wire protocol, exposes a REST API,
  and publishes to Kafka; `server/dashboard` and `server/artist-portal` are the web UIs.
- **[`lattice-nodes`](https://github.com/superbrobenji/lattice-nodes)** — the ESP32 firmware that
  runs on the mesh nodes and the serial-attached master. See [Section 3](#3-lattice-nodes-what-it-is-and-how-it-connects-here)
  below.
- **[`lattice-protocol`](https://github.com/superbrobenji/lattice-protocol)** — the shared wire
  format. Not vendored source in this repo; it's a direct Go dependency.

## 1. The `lattice-protocol` dependency

`server/orchestrator/go.mod` pins it as a direct dependency:

```
github.com/superbrobenji/lattice-protocol v0.6.0
```

There is no `replace` directive — `server/orchestrator` builds against that tagged release as
published. `lattice-protocol` is a Go struct definition with dual `c:`/`proto:` tags; the same
source codegens the Go types this repo imports *and* the C headers `lattice-nodes` vendors as a
git submodule. Both sides deserialize the same wire bytes because both sides are generated from
the same schema — that's the coupling this whole document is about.

**Note on doc coverage:** an earlier pass of this docs-rewrite effort found zero docs in this repo
mentioning `lattice-protocol` by name, despite 6+ recent commits (`f5bdaad`, `794279e`, `0bfc73e`,
`943b158`, ...) being entirely about tracking its breaking changes. That gap has since been
partially closed by sibling tasks in this same effort: the top-level `README.md` now has an
"Ecosystem" section naming `lattice-protocol` and its pinned version, and
`server/orchestrator/README.md` mentions it in the JOIN_ACK payload section (both current as of
this writing — verified by grepping `*.md` repo-wide). This document is the dedicated, complete
treatment: it's the one place that states the version-coupling contract, the flag-day operational
consequence, and the `lattice-nodes` relationship together, rather than as scattered asides.

## 2. The flag-day relationship

**Bump `lattice-protocol` → firmware must be reflashed → old nodes are silently dropped by the
`ProtoVersion` check.**

This is not a hypothetical — it has already happened twice in this repo's history:

- `#115` bumped to `v0.5.0` for protocol v4 (flag-day).
- `#117` bumped to `v0.6.0` for protocol v5, alongside a JOIN_ACK wire shrink (flag-day).

The mechanism (see [wire_protocol.md](wire_protocol.md) for the full wire-format writeup): every `MeshMessage`
carries a `ProtoVersion` field. `server/orchestrator/mesh/server.go` checks incoming messages
against the version this build was compiled to expect — currently hardcoded to `5` in multiple
places in `mesh/server.go` and `mesh/message_builder.go`. A mismatch:

```go
if msg.ProtoVersion != 5 {
    slog.Warn("Unsupported proto version — dropping", "version", msg.ProtoVersion, "origin", ...)
    // message is dropped here — no reply is sent
}
```

is logged as a `Warn`, not an `Error`, and the message is dropped with **no reply sent back to the
node**. From the node's perspective this looks identical to a lost radio packet or a server outage
— there is no explicit rejection message, no error opcode, nothing actionable in the firmware's
logs. A node running old firmware against a bumped server will retry, get silently dropped every
time, and never enroll or report events again. Operationally this reads as "the mesh went dark,"
not "version mismatch," which makes it easy to misdiagnose in the field.

**Operational guidance for whoever bumps `lattice-protocol` in `go.mod`:**

1. Before merging the bump, confirm whether the new `lattice-protocol` version changes the wire
   format in a way that changes `ProtoVersion` (check the release notes / CHANGELOG in
   `lattice-protocol`, and diff the generated struct). Not every bump is a flag day — patch
   releases that don't touch wire-visible fields are safe to roll out without a coordinated
   reflash.
2. If it *is* a flag day: update the hardcoded `ProtoVersion` check and all the literal version
   values in `mesh/server.go` and `mesh/message_builder.go` in the same PR as the `go.mod` bump —
   don't let the dependency bump and the version-constant update land separately.
3. Coordinate the `lattice-nodes` reflash with the server deploy. Every node still running the old
   `ProtoVersion` goes dark the moment the new server build is live — there is no compatibility
   window, no negotiation, no fallback. Treat it like a hardware maintenance window, not a rolling
   software deploy.
4. Record the bump in the PR title/description the way `#115` and `#117` did (`chore(deps): bump
   lattice-protocol to vX.Y.Z (protocol vN flag-day, <what changed>)`) — that history is what let
   this document reconstruct the flag-day track record above; keep it going for the next bump.

## 3. `lattice-nodes`: what it is and how it connects here

[`lattice-nodes`](https://github.com/superbrobenji/lattice-nodes) is the ESP32 mesh firmware,
built on ESP-IDF (no Arduino tooling). Its nodes talk peer-to-peer over ESP-NOW, with sensor/control
payloads protected end-to-end (X25519 + ChaCha20-Poly1305 AEAD) between an originating node and the
master, on top of a TOFU master-public-key enrollment scheme. One designated node — the master —
bridges the RF mesh to this repo: it is physically connected over **USB serial** to the
`server/orchestrator` process here, which is the only component in `lattice-hub` that speaks the
wire protocol directly. `lattice-hub` never talks ESP-NOW and never talks to non-master nodes
directly; everything is relayed through the master over that one serial link.

For firmware-side details — building, flashing, the adapter system, enrollment, and the serial wire
format from the node's perspective — see `lattice-nodes`' own docs, in particular its
[`README.md`](https://github.com/superbrobenji/lattice-nodes/blob/main/README.md) (which has a
matching "Ecosystem" section describing this same three-repo relationship from the firmware's
side) and
[`docs/server_requirements.md`](https://github.com/superbrobenji/lattice-nodes/blob/main/docs/server_requirements.md)
(the serial/wire contract a server must implement, verified against the `lattice-protocol`
submodule pinned at `v0.6.0` — the same version this repo pins independently as a Go module).
Link targets verified against a local checkout of `lattice-nodes` at the time of writing.
