<!-- SPDX-License-Identifier: MIT -->

# Design: lattice-protocol v0.4.0 Hub Support (Protocol v3)

**Status:** Approved 2026-07-21.
**Paired with:** `lattice-nodes` Phase 1 plan (`docs/superpowers/plans/2026-07-16-phase1-proto-v3-e2e-aead.md`) and the shared spec (`docs/superpowers/specs/2026-07-16-multihop-routing-e2e-crypto-design.md`).

## Context

`lattice-protocol v0.4.0` ships the protocol v3 wire format: five new fields appended to `MeshMessage` after the existing `enrollment_public_key` (field 11). The 127-byte v2 prefix is layout-unchanged; the full frame is now 242 bytes.

New fields:

| Field | Proto # | Type | Purpose |
|---|---|---|---|
| `routeLen` | 12 | uint32 (optional) | Relay path length in route reports and downlink source-route frames |
| `routePath` | 13 | bytes (optional) | Relay MACs: `routeLen × 6` bytes, in forward order |
| `authTag` | 14 | bytes (optional) | ChaCha20-Poly1305 tag over `data[64]` — **E2E, firmware-only** |
| `secondaryMasterMac` | 15 | bytes (optional) | Dual-master: secondary master MAC in JOIN_ACK (Phase 4) |
| `secondaryPublicKey` | 16 | bytes (optional) | Dual-master: secondary master Curve25519 pubkey in JOIN_ACK (Phase 4) |

**Hub crypto role: none.** Per spec §8: "AEAD encrypt/decrypt happens on master firmware, not the server, so no crypto lands in Go beyond field pass-through." The hub never inspects or verifies `authTag`. The hub never generates or holds a Curve25519 key pair. `secondaryMasterMac`/`secondaryPublicKey` JOIN_ACK population is Phase 4 work.

**Flag day.** No v2 backward compatibility. All nodes reflash to v3 (proto_version = 3).

## Changes

### 1. Dependency bump

`server/orchestrator/go.mod`:
```
github.com/superbrobenji/lattice-protocol v0.3.1-0.20260713121739-c1b5a3ac4f67
→ github.com/superbrobenji/lattice-protocol v0.4.0
```

Run `go mod tidy` after bumping.

### 2. Proto update + codegen

`mesh/mesh.proto` — add five fields after `public_key = 11`:

```proto
optional uint32 routeLen          = 12;
optional bytes  routePath         = 13;
optional bytes  authTag           = 14;
optional bytes  secondaryMasterMac = 15;
optional bytes  secondaryPublicKey  = 16;
```

Regenerate `mesh/mesh.pb.go` via `protoc --go_out=. mesh/mesh.proto` (or the project's existing protoc invocation — match the existing `go_package` option).

### 3. ProtoVersion gating (`mesh/server.go`)

Current (line ~366):
```go
if msg.ProtoVersion > 0 && msg.ProtoVersion != 2 {
    slog.Warn("Unsupported proto version — dropping", ...)
    return nil
}
```

New — accept 0 (legacy), 2 (v2 nodes during transition), and 3; drop anything higher:
```go
if msg.ProtoVersion > 3 {
    slog.Warn("Unsupported proto version — dropping", ...)
    return nil
}
```

(Accepting 2 during the reflash window is fine even though we don't send v2 ourselves.)

### 4. Route report migration (`mesh/server.go`)

`handleRouteReport` currently reads the relay path from the `Data[]` payload (`data[1]` = pathLen, `data[2+i*6]` = relay MACs). In protocol v3 the data payload is sealed ciphertext — unreadable by the hub. The relay path is now in the plaintext `RouteLen`/`RoutePath` header fields.

New logic:
- `pathLen = int(msg.RouteLen)`
- Bounds-check: `pathLen > 10` → drop with a warning (same bound as before)
- Length-check: `len(msg.RoutePath) < pathLen*MACAddressLength` → drop with a warning
- Extract relay MACs from `msg.RoutePath[i*6 : (i+1)*6]`
- Remove all reads of `msg.Data` in this handler

The opcode byte (`msg.Data[0] == OpRouteReport`) check is also dropped — the message type field already identifies the frame; reading `data[0]` from sealed ciphertext is meaningless.

### 5. Meshsim updates (`meshsim/frames.go`)

**`envelope()`**: bump `ProtoVersion` from 2 to 3.

**`routeReportMsg()`**: migrate path encoding from `Data[]` payload to `RouteLen`/`RoutePath` header fields.

Current:
```go
data := make([]byte, 2+len(n.RoutePath)*6)
data[0] = byte(mesh.OpRouteReport)
data[1] = byte(len(n.RoutePath))
for i, relay := range n.RoutePath {
    copy(data[2+i*6:], relay[:])
}
m.Data = data
```

New:
```go
m.RouteLen = uint32(len(n.RoutePath))
routePath := make([]byte, len(n.RoutePath)*6)
for i, relay := range n.RoutePath {
    copy(routePath[i*6:], relay[:])
}
m.RoutePath = routePath
```

No `Data` payload on route report frames — matches firmware v3 behaviour (data is sealed; path is in the header).

## Out of Scope

- `authTag` AEAD verification — firmware-only (spec §8).
- Hub Curve25519 key pair — not needed; master firmware manages its own keys.
- `secondaryMasterMac`/`secondaryPublicKey` JOIN_ACK population — Phase 4; hub does not yet have a mechanism to learn the secondary master's public key.
- nanopb regeneration (`mesh/serialization/mesh.pb.*`) — this is firmware-side; the hub's `mesh/mesh.proto` is a separate copy.

## Testing

- Existing `mesh/server_test.go` cases that send ProtoVersion 2 frames should be updated to ProtoVersion 3.
- `meshsim` route-report tests must verify `RouteLen`/`RoutePath` are populated rather than checking `Data[]`.
- A new `handleRouteReport` unit test should cover: valid header path, `routeLen > 10` drop, truncated `routePath` drop.
