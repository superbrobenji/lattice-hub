# Hub Wire Protocol (Deep Reference)

This is the canonical, code-traced reference for how `server/orchestrator`
(package `mesh`, primarily `mesh/server.go`) speaks to mesh nodes over
serial. It covers `ProtoVersion` enforcement, the enrollment handshake, the
`JOIN_ACK` byte layout, the health-timeout constant, and hotswap/node-ID-reuse
semantics — each cross-checked directly against the current source, not
inferred from comments or prior docs.

The orchestrator [README](../server/orchestrator/README.md#protocol) has a
summary of the same wire format (transport framing, message-type table,
adapter-type table, opcode table). This document goes one level deeper on the
five topics above; where the two overlap, this document is the source of
truth and the README should be treated as the summary.

All function/line references are to `server/orchestrator/mesh/server.go`
unless another file is named.

## ProtoVersion enforcement

Every inbound frame is checked at the very top of `handleMessage`, before
Kafka logging and before the `MessageType` switch:

```go
// handleMessage processes a received mesh message
func (ms *MeshServer) handleMessage(msg *MeshMessage) error {
	// Proto version check — 0 is legacy (pre-security), 5 is current (protocol v5).
	// Flag-day: v4 nodes must be reflashed. Drop 1, 2, 3, 4, and any future unknown version.
	if msg.ProtoVersion != 5 {
		slog.Warn("Unsupported proto version — dropping", "version", msg.ProtoVersion, "origin", fmt.Sprintf("%x", msg.OriginMacAddress))
		return nil
	}
	...
```

Key points, verified from this function body:

- **Only `ProtoVersion == 5` is accepted.** `0` was the legacy pre-security
  wire format; `1`–`4` are earlier revisions of the current secure format.
  This is a flag-day cutover — a node stuck on `4` cannot be re-paired, it
  must be reflashed.
- **The check applies to every `MessageType`**, including `ENROLLMENT`
  (`MessageTypeEnrollment = 2`). A node speaking the wrong `ProtoVersion`
  never reaches `handleEnrollmentRequest` at all — the enrollment handshake
  described below cannot begin until the frame's `ProtoVersion` is `5`.
- **On mismatch, the frame is logged and dropped — not silently discarded.**
  The server emits `slog.Warn("Unsupported proto version — dropping",
  "version", msg.ProtoVersion, "origin", ...)`, then returns `nil`.
  Returning `nil` (not an error) means `messageProcessor`'s
  `if err := ms.handleMessage(msg); err != nil { slog.Error(...) }` does
  *not* additionally log a handling failure — the `Warn` line is the only
  trace left. No response frame is sent back over the wire, and the frame
  is never passed to `logMessageToKafka` (that call happens after the
  version check, so a rejected frame is never mirrored to Kafka either).
- A separate, unrelated "logged and dropped" case lives one level down in
  the same function: if `MessageType == MessageTypeJoinAck` (`4`) is
  received *by the hub* (JOIN_ACK is master→node only; the hub should never
  see one arrive), `handleMessage`'s switch logs
  `slog.Warn("Unexpected JOIN_ACK received — ignoring", ...)` and returns
  `nil` — same "logged, not silent" pattern as the version check, just for
  a different condition.

Prior note for anyone cross-checking this against `mesh.proto`: the
`protoVersion` field comment there still reads `// must be 1 for v1
messages`, which predates the current v5 wire format and is stale. The
enforced value lives in code (`handleMessage`, above), not in that comment.

## Message dispatch, for context

`handleMessage`'s switch on `msg.MessageType` (after the version check
passes):

| `MessageType` | Value | Handler |
|---|---|---|
| `ADAPTER_DATA` | 0 | `handleAdapterData` → dispatches again on `DataType` (`AdapterTypeSerial` → `handleSerialData`, which switches on the opcode byte at `Data[0]`; `AdapterTypePIR` → `handlePIRData`; anything else is logged at `Debug` and ignored) |
| `MASTER_BEACON` | 1 | `handleMasterBeacon` — logs at `Debug` only, no state change |
| `ENROLLMENT` | 2 | `handleEnrollmentRequest` (see below) |
| `SERIAL_CMD_BROADCAST` | 3 | no case in the switch — falls to `default`, logged as `"Unknown message type"`. The hub only ever *sends* this type — `OP_NODE_ID_SET` (built inline in `ApproveEnrollment`) and `SendNodeData`/`BuildBroadcastMessage`. **Not** `OP_CONFIG_SET`: `BuildConfigSetMessage` (`message_builder.go:17-35`) sets `MessageType: MessageTypeAdapterData` (type 0), so `OP_CONFIG_SET` frames — including the hotswap one — travel as `ADAPTER_DATA`, not `SERIAL_CMD_BROADCAST`. This type has no inbound handling. |
| `JOIN_ACK` | 4 | logged and ignored — see above |
| `ROUTE_REPORT` | 5 | `handleRouteReport` |
| anything else | — | `slog.Warn("Unknown message type", "type", msg.MessageType)` |

## Enrollment handshake sequence

The full sequence is **ENROLLMENT → (out-of-band admin approval) → JOIN_ACK
→ OP_NODE_ID_SET**, with an optional trailing OP_CONFIG_SET on hotswap. The
middle step is not automatic — reading `handleEnrollmentRequest` and
`ApproveEnrollment`/`RejectEnrollment` together, and grepping for their
call sites, shows the hub never approves a node on its own. Approval only
happens when something outside the serial-receive path calls
`ApproveEnrollment`/`RejectEnrollment` — in practice the admin-tier HTTP
handlers `v1ApproveEnrollment`/`v1RejectEnrollment`
(`mesh/api_v1_enrollments.go`) and their legacy counterparts in `api.go`,
reached via `POST /api/v1/enrollments/{mac}/approve` or `.../reject`. A node
can sit in `TrustPending` indefinitely with no hub-side timeout.

### Step 1 — Node → Hub: `ENROLLMENT`

`handleEnrollmentRequest` (`server.go:525-568`):

1. Validates `len(msg.OriginMacAddress) >= 6` (error: `"enrollment request
   missing origin MAC"`) and `len(msg.PublicKey) == 32`
   (error: `"enrollment request has invalid public key length: %d"`).
   The MAC and 32-byte Curve25519 public key ride in the message envelope
   fields directly — not packed into `Data`.
2. Calls `ms.authRegistry.AddPending(mac, pubKey)`
   (`nodeauth/registry.go:39-54`), which creates (or overwrites, if not
   already `TrustApproved`) a `NodeAuth` entry with `Status: TrustPending`
   and `ReceivedAt: time.Now()`. If the MAC is already `TrustApproved`,
   `AddPending` returns an error (`"node %s already approved"`) and
   `handleEnrollmentRequest` returns that error without persisting or
   publishing anything further.
3. If `authPath` is configured, persists the auth registry to disk
   immediately — so a pending request survives a hub restart before an
   admin acts on it.
4. If `eventStore` is configured, publishes a Kafka message (topic
   `mesh-enrollment`) with `{"type":"enrollment_request","mac":...,
   "publicKey":...,"timestamp":...}`.

**Nothing is sent back to the node in this step.** There is no
auto-acknowledgment; the node has to wait for a `JOIN_ACK` that only
arrives once an admin approves.

### Step 2 — Admin approval (out of band)

Reached via `ApproveEnrollment(macStr string, params ApprovalParams)`
(`server.go:669-788`), called from the HTTP layer, not from the serial path:

1. `ms.authRegistry.Approve(macStr)` (`nodeauth/registry.go:56-70`) flips
   the entry to `TrustApproved` and stamps `ApprovedAt`. Errors if the MAC
   isn't in the registry at all.
2. Node ID resolution: if `params.NodeID == 0`, auto-assign via
   `ms.nodeRegistry.NextFreeNodeID()` — the lowest free ID in `1..255`;
   returns `0` (with a `slog.Warn("All node IDs in use...")`) if all 255
   are taken. If `params.NodeID` is nonzero, that explicit ID is used —
   this is also the hotswap trigger (see below).
3. `ms.nodeRegistry.AssignNode(node.MAC[:], nodeId, params.Name,
   params.Zone)` always runs, regardless of whether `nodeId` ended up `0`.
   `AssignNode` defaults an empty `Name` to the MAC string
   (`node_registry.go`, comment `#63 belt-and-suspenders: never store an
   empty name`).
4. `publishEnrolledEvent` publishes an SSE `EventEnrolled`
   (`{"nodeId":...,"name":...,"type":...}`, `type` defaulting to
   `"unknown"` if `params.AdapterTypeStr` is empty).
5. Only if `ms.serialComm != nil` (server actually running with a serial
   port open) does anything go out over the wire — see Step 3 below.
6. Finally, if `authPath` is configured, persists the auth registry — this
   is the one failure mode `ApproveEnrollment` actually returns to its
   caller; every serial-send failure above is logged and swallowed (see
   Step 3).

### Step 3 — Hub → Node: `JOIN_ACK`, then `OP_NODE_ID_SET`

Still inside `ApproveEnrollment`, guarded by `ms.serialComm != nil`
(`server.go:720-781`):

1. **`JOIN_ACK` is built and sent first.** See the byte layout section
   below for the full frame. Sent via `ms.activeOutboundComm().WriteFrame`
   — i.e., it participates in primary/secondary failover
   (`activeOutboundComm` switches to the secondary port once the primary
   has been silent for more than 75 seconds, `server.go:302-320`). A send
   failure is only logged (`slog.Warn("Failed to send JOIN_ACK", ...)`) —
   it does **not** abort the function or roll back the registry changes
   already made in Step 2.
2. **`OP_NODE_ID_SET` is sent immediately after, in the same function, no
   wait for any node response** — but only `if nodeId > 0`. The payload:

   ```go
   payload := make([]byte, MaxDataLength) // 64 bytes, zero-filled
   payload[0] = OpNodeIdSet          // 0xC0
   copy(payload[1:7], node.MAC[:])   // target MAC (the enrolling node's own MAC)
   payload[7] = nodeId
   ```

   wrapped in a `MeshMessage{ProtoVersion: 5, MessageType:
   MessageTypeSerialCmdBroadcast, DataType: AdapterTypeSerial, Data:
   payload}`, also sent via `activeOutboundComm()`. Bytes `payload[8:64]`
   stay zero. **If `nodeId` came back `0`** (registry exhausted, see Step
   2.2), this frame is skipped entirely — the node gets a `JOIN_ACK` but is
   never assigned an ID on the wire.
3. **`OP_CONFIG_SET` is sent last, and only on hotswap** with an inherited
   adapter type — see the Hotswap section below. Unlike the two frames
   above, this one is sent via `ms.serialComm.WriteFrame` directly, **not**
   `activeOutboundComm()` — so, unlike `JOIN_ACK` and `OP_NODE_ID_SET`, this
   specific frame does not fail over to the secondary port if the primary
   has gone stale.

### Rejection path: `JOIN_ACK` with empty `PublicKey`

`RejectEnrollment(macStr string)` (`server.go:792-823`) is the sibling
entry point:

1. `nodeauth.ParseMAC(macStr)` to get the raw MAC (accepts colon-hex or
   bare-hex).
2. `ms.authRegistry.Reject(macStr)` sets `Status: TrustRejected`. The node
   is **not removed** from the registry, just marked rejected.
3. If `ms.serialComm != nil`, sends a `JOIN_ACK` frame with
   `ProtoVersion: 5`, `OriginMacAddress: ms.masterMAC[:]`,
   `TargetMacAddress: mac[:]`, and both `PublicKey` and `Data` left as their
   Go zero value (unset/nil). The code comment is explicit about this being
   the discriminator: `// PublicKey intentionally absent — rejection
   signal`. There is no separate rejection message type or opcode — an
   empty `PublicKey` on an otherwise-normal `JOIN_ACK` *is* the rejection
   signal. Send failure here is explicitly best-effort (comment: `// best-
   effort; do not block the rejection`) and does not stop the function from
   persisting the rejection.
4. Persists the auth registry if `authPath` is configured.

## `JOIN_ACK` byte layout (canonical)

Built in `ApproveEnrollment` (`server.go:720-746`). Top-level `MeshMessage`
fields, approval case:

| Field | Value |
|---|---|
| `ProtoVersion` | `5` |
| `MessageType` | `MessageTypeJoinAck` (`4`) |
| `OriginMacAddress` | `ms.masterMAC[:]` — the hub's configured master MAC (`MASTER_MAC` env / `loadMasterIdentity()` in `main.go`; if unset, this is all-zero and firmware rejects the enrollment per the orchestrator README's env-var table) |
| `TargetMacAddress` | the enrolling node's MAC (`node.MAC[:]`) |
| `PublicKey` | `ms.masterPublicKey[:]` — the hub's 32-byte Curve25519 public key. **This is the field the rejection path leaves empty**, per above. |
| `Data` | a fixed 64-byte (`MaxDataLength`) buffer, layout below |

`Data` byte layout — verbatim from the source comment immediately above the
construction, labeled "v6 wire shrink (data\[64\] layout, design §8)":

| Bytes | Field | Populated when |
|---|---|---|
| `data[0:4]` | First 4 bytes of the enrolling node's own public key (fingerprint echo) | always — `copy(fingerprint[0:4], node.PublicKey[:4])` |
| `data[4:10]` | Secondary master's MAC | only if `ms.secondaryMasterMAC != [6]byte{}` (dual-master mode configured); zero otherwise |
| `data[10:42]` | Secondary master's 32-byte Curve25519 public key | same condition as above; zero otherwise |
| `data[42:64]` | Reserved | always zero (buffer is `make([]byte, MaxDataLength)`; only bytes `[0:42]` are ever written) |

The dual-master fields are gated by a single check:

```go
if ms.secondaryMasterMAC != ([6]byte{}) {
    copy(fingerprint[4:10], ms.secondaryMasterMAC[:])
    copy(fingerprint[10:42], ms.secondaryMasterPublicKey[:])
}
```

The source comment also records that the top-level proto fields 15/16
(`SecondaryMasterMac`/`SecondaryPublicKey` on the `MeshMessage` envelope)
were retired in lattice-protocol v0.6.0 — this is confirmed independently
in `mesh.proto`, where fields 15/16 are absent and a comment marks them
retired-not-reused. Dual-master identity travels exclusively through this
`Data` payload now, not through separate envelope fields.

Rejection-case `JOIN_ACK`, by contrast, leaves both `PublicKey` and `Data`
unset (see Rejection path above) — there is no byte layout to speak of on
that path, which is itself the signal.

## Health-report timeout: 75s (= 2.5× the 30s interval), and where it lives

There is **no single named constant** — the value `75 * time.Second`
appears as a literal in two independent places, and they can drift apart:

1. `server/orchestrator/main.go:116` — `HealthTimeout: 75 * time.Second` is
   set on `MeshServerConfig` at startup. This becomes `ms.healthTimeout`
   (`server.go:57`, `server.go:150`), exposed via
   `GetHealthTimeout()` (`server.go:913`). Every online/offline
   determination inside `mesh/server.go` and `mesh/api_v1_status.go` reads
   from this one value:
   - `publishHealthEvent` (`server.go:973`): `online := time.Since(node.LastSeen) <= ms.healthTimeout`, fired synchronously right after every health report is recorded — practically always `true` at that instant, since `UpdateNode` just set `LastSeen = time.Now()`.
   - `checkOfflineNodes` (`server.go:1024`): `if time.Since(node.LastSeen) > ms.healthTimeout` — the actual "went offline" detector, run from `offlineDetectorLoop` on a **separate 30-second ticker** (`server.go:1005`, `time.NewTicker(30 * time.Second)`). It only publishes `EventNodeOffline` on the transition edge, gated by the `ms.nodeOnlineState` map, not on every tick for every stale node.
   - `IsMasterOnline` (`server.go:1054`): `time.Since(t) < ms.healthTimeout`, used for the mesh-level "is the master itself alive" signal surfaced in `/api/v1/status`.
   - `api_v1_status.go`'s `v1Status` handler (the `/api/v1/status` endpoint) calls `api.meshServer.GetHealthTimeout()` and uses the same `isOnline(n, timeout)` helper for its per-node online/offline counts.
2. `server/orchestrator/mesh/api.go:331` — inside the **legacy** (non-v1)
   `getStatus` handler (`/status`), the exact same duration is
   independently hardcoded: `registry.GetOnlineNodes(75 * time.Second)`,
   with the comment `// 2.5× the 30s health interval — single missed report
   no longer marks offline`. This call does **not** go through
   `GetHealthTimeout()` — it's a second, separate literal.

Because these are two independent literals rather than one shared constant,
changing `main.go`'s `HealthTimeout` without also updating `api.go:331`
would make the legacy `/status` endpoint and the `/api/v1/status` endpoint
disagree about which nodes count as online. This is a real inconsistency
visible directly in the source, not a hypothetical.

The "2.5× the 30s health interval" framing is the source code's own
comment at `api.go:331`; the "30s" side of that ratio (how often a node's
firmware sends a health report) is asserted by that comment and is not
independently re-verified against firmware in this document, since
firmware lives outside this repo. The one 30-second figure this document
*does* independently verify from `mesh/server.go` is the hub's own
`offlineDetectorLoop` poll cadence (`ticker := time.NewTicker(30 *
time.Second)`, `server.go:1005`) — a poll interval, not the same thing as
the node's report-send interval, though the two numbers match.

Separately, `activeOutboundComm`/`activeOutboundCommLocked`
(`server.go:302-337`) use their own, unrelated `75 * time.Second`
`failoverThreshold` constant to decide when to switch outbound writes from
the primary to the secondary serial port. It is the same numeric value as
the health timeout by coincidence of both being tuned around the same
30-second reporting cadence, not because they share a constant — each
function declares its own local `const failoverThreshold = 75 *
time.Second`.

## Hotswap / node-ID-reuse semantics (`ApproveEnrollment`)

Hotswap is decided entirely by **explicit admin input at approval time**,
not by anything the node itself sends. It triggers when all of the
following hold (`server.go:684-702`):

```go
var hotswapOldMAC []byte
inheritedAdapterType := AdapterTypeUnknown // sentinel: no inheritance
if params.NodeID > 0 {
    if oldNode, ok := ms.nodeRegistry.GetNodeByID(params.NodeID); ok &&
        !bytes.Equal(oldNode.MAC, node.MAC[:]) {
        hotswapOldMAC = oldNode.MAC
        if params.Name == "" {
            params.Name = oldNode.Name
        }
        if params.Zone == "" {
            params.Zone = oldNode.Zone
        }
        if params.AdapterTypeStr == "" && oldNode.AdapterType != AdapterTypeUnknown {
            inheritedAdapterType = oldNode.AdapterType
        }
    }
}
```

- **Trigger:** the admin's approval request supplies a nonzero `NodeID`
  (`params.NodeID > 0`), *and* `GetNodeByID` finds an existing, non-
  `"replaced"` node already holding that ID, *and* that existing node's MAC
  differs from the MAC being approved right now. Re-approving the same MAC
  with the ID it already owns is **not** a hotswap — the `bytes.Equal`
  check excludes that case.
- **Field inheritance:** any of `Name`, `Zone`, or adapter type left blank
  in the approval request are backfilled from the node being displaced —
  not from any default. `AdapterTypeStr` is only inherited if the old node
  had a known (non-`AdapterTypeUnknown`) adapter type; if the old node's
  adapter type was itself unknown, `inheritedAdapterType` stays at the
  sentinel and no `OP_CONFIG_SET` is sent later.
- **Ordering matters, and is commented in the source:** the new node is
  assigned first (`ms.nodeRegistry.AssignNode(node.MAC[:], nodeId, ...)`,
  `server.go:705`), and only *after that* is the old node marked replaced
  (`ms.nodeRegistry.MarkReplaced(hotswapOldMAC, macToString(node.MAC[:]))`,
  `server.go:708-710`), with the comment `// Mark old node replaced after
  new node is assigned (ensures GetNodeByID uniqueness)`. Both calls
  acquire and release the registry's lock independently rather than
  sharing one critical section, so there is a narrow window between the
  two calls where two `NodeInfo` entries hold the same `NodeID`
  simultaneously (the old one not yet marked `"replaced"`, the new one
  already assigned) — a concurrent `GetNodeByID` call in that window is not
  guaranteed to see only one of them, though whichever the map iteration
  returns first in `GetNodeByID`'s scan wins.
- **What `MarkReplaced` actually changes**
  (`node_registry.go:252-263`): on the *old* node's `NodeInfo`,
  `Status = "replaced"`, `ReplacedBy = <new node's MAC string>`, and
  `NodeID = 0` — so the old entry drops out of `GetNodeByID`,
  `GetNodesByZone`, and `GetOnlineNodes` (all three filter on
  `Status != "replaced"`), but is **not deleted** from the registry; it
  remains visible via `GetAllNodes`, now unassigned and pointing at its
  replacement.
- **The `nodeauth` registry is untouched by a hotswap.** `MarkReplaced`
  only ever touches `ms.nodeRegistry` (the `NodeInfo` map). The old MAC's
  entry in `ms.authRegistry` (the `nodeauth.NodeAuth`, tracking
  `TrustApproved`/`TrustPending`/`TrustRejected`) is never modified by a
  hotswap — it stays `TrustApproved` even though its `NodeInfo` counterpart
  has lost its `NodeID` and place in the mesh. Re-enrollment trust and
  logical-ID assignment are two separate pieces of state that a hotswap
  only updates one of.
- **Wire effect:** the standard `JOIN_ACK` + `OP_NODE_ID_SET` pair is sent
  to the *new* MAC regardless of hotswap (Step 3 above is unconditional on
  hotswap; hotswap only changes what data feeds into the frames). The one
  hotswap-specific frame is an additional `OP_CONFIG_SET`
  (`server.go:770-780`), sent **only if `inheritedAdapterType !=
  AdapterTypeUnknown`**, built via `messageBuilder.BuildConfigSetMessage
  (node.MAC[:], inheritedAdapterType)` — payload `[0xC1][6-byte target
  MAC][adapter type byte]`, `TargetMacAddress` set to the new node's MAC,
  `OriginMacAddress` set to `ms.masterMAC[:]` after the builder returns.
  As noted in Step 3, this frame goes out via `ms.serialComm.WriteFrame`
  directly, not `activeOutboundComm()`, so it does not fail over to the
  secondary serial port the way `JOIN_ACK`/`OP_NODE_ID_SET` do.
- **Old node ID exhaustion is unaffected by hotswap logic.** Auto-assignment
  (`NextFreeNodeID`, used when `params.NodeID == 0`) never triggers the
  hotswap branch at all, since that branch is gated on `params.NodeID > 0`.
  A hotswap only ever happens when an admin deliberately names the ID being
  reused.
