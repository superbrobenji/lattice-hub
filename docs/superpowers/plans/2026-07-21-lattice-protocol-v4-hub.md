# Lattice Protocol v0.4.0 Hub Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Teach the hub to speak protocol v3: bump the lattice-protocol dependency to v0.4.0, add the five new wire-format fields to the proto, update ProtoVersion gating to a flag-day v3-only policy, and migrate `handleRouteReport` and the meshsim to use the new header-based route path.

**Architecture:** Four self-contained changes in dependency order — dep + codegen first (no logic), then ProtoVersion gating (drop v2), then route report handler migration (header fields replace Data[] reads), then meshsim (emit v3 frames with header-based paths). No crypto is added to the Go side; AEAD is firmware-only per spec §8.

**Tech Stack:** Go 1.25, `google.golang.org/protobuf`, `protoc v35.1` with `protoc-gen-go`.

## Global Constraints

- All `go` commands: `env GOROOT= /opt/homebrew/bin/go` (plain `go` is broken in this shell — stale GOROOT).
- Working directory for all Go commands: `server/orchestrator/`.
- Test runner: `env GOROOT= /opt/homebrew/bin/go test ./... ` from `server/orchestrator/`.
- Flag-day: accept ProtoVersion 0 (legacy pre-security) and 3 only. Drop 1, 2, and > 3.
- No AEAD, no key management, no secondary-master JOIN_ACK population — firmware-only / Phase 4 work.
- Spec: `docs/superpowers/specs/2026-07-21-lattice-protocol-v4-hub-design.md`.

---

### Task 1: Dep bump + proto update + codegen

**Files:**
- Modify: `server/orchestrator/go.mod`
- Modify: `server/orchestrator/mesh/mesh.proto`
- Regenerate: `server/orchestrator/mesh/mesh.pb.go`

**Interfaces:**
- Produces: `MeshMessage` struct with new fields `RouteLen uint32`, `RoutePath []byte`, `AuthTag []byte`, `SecondaryMasterMac []byte`, `SecondaryPublicKey []byte` — used by Tasks 2, 3, and 4.

- [ ] **Step 1: Bump the dependency**

In `server/orchestrator/go.mod`, replace the lattice-protocol require line:

```
github.com/superbrobenji/lattice-protocol v0.3.1-0.20260713121739-c1b5a3ac4f67
```

with:

```
github.com/superbrobenji/lattice-protocol v0.4.0
```

Then run:

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go mod tidy
```

Expected: `go.mod` and `go.sum` updated; no errors.

- [ ] **Step 2: Add v3 fields to mesh.proto**

In `server/orchestrator/mesh/mesh.proto`, replace the closing `}` of `MeshMessage` with:

```proto
  bytes  public_key        = 11; // enrollment/join_ack: 32-byte Curve25519 public key
  optional uint32 routeLen          = 12; // v3: relay path length (header field)
  optional bytes  routePath         = 13; // v3: relay MACs — routeLen × 6 bytes, forward order
  optional bytes  authTag           = 14; // v3: ChaCha20-Poly1305 tag over data[64] (firmware-only)
  optional bytes  secondaryMasterMac = 15; // v3: dual-master: secondary master MAC in JOIN_ACK (Phase 4)
  optional bytes  secondaryPublicKey  = 16; // v3: dual-master: secondary master Curve25519 pubkey (Phase 4)
}
```

The full updated file should be:

```proto
syntax = "proto3";
package mesh;

option go_package = "github.com/superbrobenji/motionServer/mesh";

message MeshMessage {
  uint32 messageType       = 1;
  sint32 dataType          = 2;
  bytes  originMacAddress  = 3;
  bytes  targetMacAddress  = 4;
  bytes  lastHopMacAddress = 5;
  bytes  data              = 6;
  uint32 hopCount          = 7;
  uint32 epochNum          = 8;
  uint32 seqNum            = 9;
  uint32 protoVersion      = 10;
  bytes  public_key        = 11;
  optional uint32 routeLen          = 12;
  optional bytes  routePath         = 13;
  optional bytes  authTag           = 14;
  optional bytes  secondaryMasterMac = 15;
  optional bytes  secondaryPublicKey  = 16;
}
```

- [ ] **Step 3: Regenerate mesh.pb.go**

```bash
cd server/orchestrator && protoc --go_out=. --go_opt=paths=source_relative mesh/mesh.proto
```

Expected: `mesh/mesh.pb.go` is updated with new getter methods for `RouteLen`, `RoutePath`, `AuthTag`, `SecondaryMasterMac`, `SecondaryPublicKey`.

- [ ] **Step 4: Verify the build compiles**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go build ./...
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd server/orchestrator && git add go.mod go.sum mesh/mesh.proto mesh/mesh.pb.go && git commit -m "feat(mesh): bump lattice-protocol to v0.4.0; add proto v3 wire fields"
```

---

### Task 2: ProtoVersion flag-day — accept v0 and v3, drop everything else

**Files:**
- Modify: `server/orchestrator/mesh/server.go` (line ~366)
- Modify: `server/orchestrator/mesh/server_test.go`

**Interfaces:**
- Consumes: nothing new beyond Task 1's `MeshMessage`.
- Produces: `handleMessage` that drops frames with ProtoVersion 1, 2, or > 3 and accepts 0 and 3.

- [ ] **Step 1: Update TestHandleMessage_ProtoVersionGuard**

In `server/orchestrator/mesh/server_test.go`, replace the entire `TestHandleMessage_ProtoVersionGuard` function with:

```go
func TestHandleMessage_ProtoVersionGuard(t *testing.T) {
	ms := newTestMeshServer(t)
	mac := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF}

	healthData := make([]byte, 12)
	healthData[0] = byte(OpHealthReport)
	healthData[1] = byte(AdapterTypePIR)
	copy(healthData[2:8], mac)

	// v1: must be dropped.
	if err := ms.handleMessage(&MeshMessage{
		ProtoVersion: 1, MessageType: MessageTypeAdapterData,
		DataType: AdapterTypeSerial, Data: healthData, OriginMacAddress: mac,
	}); err != nil {
		t.Fatalf("handleMessage(v1) returned unexpected error: %v", err)
	}
	if _, ok := ms.GetNodeRegistry().GetNode(mac); ok {
		t.Error("v1 message must be dropped — node must not be registered")
	}

	// v2: flag-day drop; no v2 backward compatibility.
	if err := ms.handleMessage(&MeshMessage{
		ProtoVersion: 2, MessageType: MessageTypeAdapterData,
		DataType: AdapterTypeSerial, Data: healthData, OriginMacAddress: mac,
	}); err != nil {
		t.Fatalf("handleMessage(v2) returned unexpected error: %v", err)
	}
	if _, ok := ms.GetNodeRegistry().GetNode(mac); ok {
		t.Error("v2 message must be dropped — flag-day migration to v3")
	}

	// v3: must be accepted and processed.
	if err := ms.handleMessage(&MeshMessage{
		ProtoVersion: 3, MessageType: MessageTypeAdapterData,
		DataType: AdapterTypeSerial, Data: healthData, OriginMacAddress: mac,
	}); err != nil {
		t.Fatalf("handleMessage(v3) returned unexpected error: %v", err)
	}
	if _, ok := ms.GetNodeRegistry().GetNode(mac); !ok {
		t.Error("v3 message must be processed — node should be registered after health report")
	}
}
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./mesh/... -run TestHandleMessage_ProtoVersionGuard -v
```

Expected: FAIL — the v2 assertion fails because v2 is currently accepted, and the v3 case may fail because v3 is currently dropped.

- [ ] **Step 3: Update the ProtoVersion gate in server.go**

In `server/orchestrator/mesh/server.go`, find the block that starts with:

```go
	// Proto version check — version 0 means legacy (pre-security) node; allow it.
	// Any protoVersion > 0 that is not 2 is an unknown future version; drop it.
	if msg.ProtoVersion > 0 && msg.ProtoVersion != 2 {
```

Replace it with:

```go
	// Proto version check — 0 is legacy (pre-security), 3 is current (protocol v3).
	// Flag-day: v2 nodes must be reflashed. Drop 1, 2, and any future unknown version.
	if msg.ProtoVersion != 0 && msg.ProtoVersion != 3 {
```

- [ ] **Step 4: Run the guard test to verify it passes**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./mesh/... -run TestHandleMessage_ProtoVersionGuard -v
```

Expected: PASS.

- [ ] **Step 5: Update all other test messages from ProtoVersion 2 to 3**

In `server/orchestrator/mesh/server_test.go`, change every `ProtoVersion: 2` to `ProtoVersion: 3`. There are three occurrences outside the guard test (in `TestHandleNodeHealth_RegistersNode`, `TestMeshServer_PublishesMotionEvent_OnPIRData`, and `TestMeshServer_PublishesNodeOnline_OnFirstHealthReport`).

Use your editor to replace all `ProtoVersion:     2,` with `ProtoVersion:     3,` in this file. Confirm the count:

```bash
grep -c "ProtoVersion:" server/orchestrator/mesh/server_test.go
```

Expected: 5 occurrences total (3 in other tests + 2 in the guard test you already updated in Step 1). All should now be 3, except no occurrence of `2` remains.

Verify none remain:

```bash
grep "ProtoVersion:.*2" server/orchestrator/mesh/server_test.go
```

Expected: no output.

- [ ] **Step 6: Run the full mesh test suite**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./mesh/... -v
```

Expected: ALL PASS.

- [ ] **Step 7: Commit**

```bash
cd server/orchestrator && git add mesh/server.go mesh/server_test.go && git commit -m "feat(mesh): flag-day ProtoVersion gate — accept v0 and v3, drop v1/v2"
```

---

### Task 3: handleRouteReport — read from header fields

**Files:**
- Modify: `server/orchestrator/mesh/server.go` (`handleRouteReport` function)
- Modify: `server/orchestrator/mesh/server_route_report_test.go`

**Interfaces:**
- Consumes: `msg.RouteLen uint32`, `msg.RoutePath []byte` from `MeshMessage` (Task 1).
- Produces: `handleRouteReport` that reads `pathLen` from `msg.RouteLen` and relay MACs from `msg.RoutePath[i*6:]`; never reads `msg.Data`.

- [ ] **Step 1: Rewrite the test file**

Replace the entire contents of `server/orchestrator/mesh/server_route_report_test.go` with:

```go
package mesh

import (
	"testing"
)

func buildRouteReportMsg(originMAC []byte, relayMACs [][]byte) *MeshMessage {
	routePath := make([]byte, len(relayMACs)*MACAddressLength)
	for i, mac := range relayMACs {
		copy(routePath[i*MACAddressLength:], mac)
	}
	return &MeshMessage{
		MessageType:      MessageTypeRouteReport,
		OriginMacAddress: originMAC,
		RouteLen:         uint32(len(relayMACs)),
		RoutePath:        routePath,
	}
}

func TestHandleRouteReport_UpdatesRegistry(t *testing.T) {
	ms := newTestMeshServer(t)
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	relay1 := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01}
	ms.nodeRegistry.AssignNode(relay1, 9, "relay", "zone")

	msg := buildRouteReportMsg(origin, [][]byte{relay1})
	if err := ms.handleRouteReport(msg); err != nil {
		t.Fatalf("handleRouteReport returned error: %v", err)
	}

	node, ok := ms.nodeRegistry.GetNode(origin)
	if !ok {
		t.Fatal("origin not in registry after route report")
	}
	if node.ParentID == nil || *node.ParentID != 9 {
		t.Errorf("ParentID = %v, want pointer to 9", node.ParentID)
	}
}

func TestHandleRouteReport_RouteLenTooLarge_Discards(t *testing.T) {
	ms := newTestMeshServer(t)
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	msg := &MeshMessage{
		MessageType:      MessageTypeRouteReport,
		OriginMacAddress: origin,
		RouteLen:         11, // > 10, too large
		RoutePath:        make([]byte, 11*MACAddressLength),
	}
	if err := ms.handleRouteReport(msg); err != nil {
		t.Errorf("expected nil error on discard, got %v", err)
	}
	_, ok := ms.nodeRegistry.GetNode(origin)
	if ok {
		t.Error("origin must not be in registry after oversized RouteLen discard")
	}
}

func TestHandleRouteReport_TruncatedRoutePath_Discards(t *testing.T) {
	ms := newTestMeshServer(t)
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	msg := &MeshMessage{
		MessageType:      MessageTypeRouteReport,
		OriginMacAddress: origin,
		RouteLen:         2,
		RoutePath:        make([]byte, 5), // only 5 bytes but 2*6=12 expected
	}
	if err := ms.handleRouteReport(msg); err != nil {
		t.Errorf("expected nil error on discard, got %v", err)
	}
	_, ok := ms.nodeRegistry.GetNode(origin)
	if ok {
		t.Error("origin must not be in registry after truncated RoutePath discard")
	}
}

func TestHandleRouteReport_EmptyRelays_NilParent(t *testing.T) {
	ms := newTestMeshServer(t)
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	ms.nodeRegistry.AssignNode(origin, 3, "origin-node", "zone")

	msg := buildRouteReportMsg(origin, [][]byte{})
	if err := ms.handleRouteReport(msg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	node, _ := ms.nodeRegistry.GetNode(origin)
	if node.ParentID != nil {
		t.Errorf("ParentID = %v, want nil for hop-1 node", *node.ParentID)
	}
}
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./mesh/... -run TestHandleRouteReport -v
```

Expected: FAIL — `TestHandleRouteReport_UpdatesRegistry` and `TestHandleRouteReport_EmptyRelays_NilParent` likely fail because the current handler reads from `Data[]` which is nil in the new test messages. `TestHandleRouteReport_TruncatedRoutePath_Discards` may fail for the same reason (old handler doesn't check `RoutePath`).

- [ ] **Step 3: Rewrite handleRouteReport in server.go**

In `server/orchestrator/mesh/server.go`, replace the entire `handleRouteReport` function with:

```go
// handleRouteReport processes a MESH_TYPE_ROUTE_REPORT (5) message.
// Protocol v3: the relay path is in the plaintext RouteLen/RoutePath header
// fields; the Data payload is sealed ciphertext and is never read here.
func (ms *MeshServer) handleRouteReport(msg *MeshMessage) error {
	pathLen := int(msg.RouteLen)
	if pathLen > 10 {
		slog.Warn("Route report RouteLen exceeds maximum",
			"routeLen", pathLen, "origin", macToString(msg.OriginMacAddress))
		return nil
	}
	if len(msg.RoutePath) < pathLen*MACAddressLength {
		slog.Warn("Route report RoutePath too short for declared RouteLen",
			"routeLen", pathLen, "routePathLen", len(msg.RoutePath),
			"origin", macToString(msg.OriginMacAddress))
		return nil
	}

	relayMACs := make([][]byte, pathLen)
	for i := 0; i < pathLen; i++ {
		mac := make([]byte, MACAddressLength)
		copy(mac, msg.RoutePath[i*MACAddressLength:(i+1)*MACAddressLength])
		relayMACs[i] = mac
	}

	ms.nodeRegistry.UpdateNodeRoute(msg.OriginMacAddress, relayMACs)

	if node, ok := ms.nodeRegistry.GetNode(msg.OriginMacAddress); ok && node.NodeID > 0 {
		eventData := map[string]interface{}{
			"nodeId":   node.NodeID,
			"parentId": nil,
		}
		if node.ParentID != nil {
			eventData["parentId"] = *node.ParentID
		}
		ms.publishEvent(EventRouteUpdate, eventData)
	}

	slog.Debug("Route report processed",
		"origin", macToString(msg.OriginMacAddress), "pathLen", pathLen)
	return nil
}
```

- [ ] **Step 4: Run the route report tests to verify they pass**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./mesh/... -run TestHandleRouteReport -v
```

Expected: 4 tests PASS.

- [ ] **Step 5: Run the full test suite**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./...
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
cd server/orchestrator && git add mesh/server.go mesh/server_route_report_test.go && git commit -m "feat(mesh): handleRouteReport reads from proto v3 header fields; drop Data[] reads"
```

---

### Task 4: Meshsim — emit ProtoVersion 3, header-based route path

**Files:**
- Modify: `server/orchestrator/meshsim/frames.go`
- Modify: `server/orchestrator/meshsim/sim_test.go`

**Interfaces:**
- Consumes: `mesh.MeshMessage.RouteLen`, `mesh.MeshMessage.RoutePath` (Task 1).
- Produces: `envelope()` stamps `ProtoVersion: 3`; `routeReportMsg()` populates `RouteLen`/`RoutePath` header fields with no `Data` payload.

- [ ] **Step 1: Update the failing assertions in sim_test.go**

In `server/orchestrator/meshsim/sim_test.go`, make the following changes:

**a)** In `TestHealthFrameLayout` (around line 53), change:

```go
	if led.DataType != int32(mesh.AdapterTypeSerial) || led.ProtoVersion != 2 || led.EpochNum != 0 {
```

to:

```go
	if led.DataType != int32(mesh.AdapterTypeSerial) || led.ProtoVersion != 3 || led.EpochNum != 0 {
```

**b)** Replace the entire `TestRouteReportFrame` function with:

```go
func TestRouteReportFrame(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	done := make(chan struct{})
	go func() { sim.tick(time.Now().Add(time.Hour)); close(done) }()
	var route *mesh.MeshMessage
	for range 4 { // 2 health + up to 2 route reports
		msg, err := orch.ReadFrame()
		if err != nil {
			t.Fatal(err)
		}
		if msg.MessageType == uint32(mesh.MessageTypeRouteReport) && macKey(msg.OriginMacAddress) == "aa:bb:cc:dd:ee:02" {
			route = msg
		}
	}
	<-done
	if route == nil {
		t.Fatal("no route report from LED node")
	}
	// Protocol v3: path is in header fields, not Data[].
	if route.RouteLen != 1 {
		t.Fatalf("RouteLen = %d, want 1", route.RouteLen)
	}
	if len(route.RoutePath) < mesh.MACAddressLength {
		t.Fatalf("RoutePath too short: %v", route.RoutePath)
	}
	if route.RoutePath[5] != 0x01 { // relay MAC last byte: aa:bb:cc:dd:ee:01
		t.Fatalf("relay MAC wrong: %v", route.RoutePath[:6])
	}
}
```

**c)** Change `ProtoVersion: 2` to `ProtoVersion: 3` in `TestCommandAckEchoesToken` and `TestOfflineNodeDoesNotAck` (the two `cmd` literals in those functions). Also update the `ack` literal in `TestJoinAckApprovesAndStartsHeartbeat` in `enrollment_test.go`:

```bash
grep -n "ProtoVersion: 2" server/orchestrator/meshsim/sim_test.go server/orchestrator/meshsim/enrollment_test.go
```

Update every occurrence found to `ProtoVersion: 3`.

- [ ] **Step 2: Run sim tests to verify they fail**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./meshsim/... -v
```

Expected: `TestHealthFrameLayout` FAIL (ProtoVersion 2 ≠ 3 assertion not yet satisfied), `TestRouteReportFrame` FAIL (RouteLen is 0 because frames.go still writes Data[]).

- [ ] **Step 3: Update frames.go**

Replace the entire contents of `server/orchestrator/meshsim/frames.go` with:

```go
package meshsim

import (
	"encoding/binary"
	"fmt"

	"github.com/superbrobenji/lattice-hub/mesh"
)

func macKey(mac []byte) string {
	if len(mac) < 6 {
		return ""
	}
	return fmt.Sprintf("%02x:%02x:%02x:%02x:%02x:%02x", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5])
}

func envelope(n *VirtualNode) *mesh.MeshMessage {
	return &mesh.MeshMessage{
		ProtoVersion:     3,
		OriginMacAddress: append([]byte(nil), n.MAC[:]...),
		HopCount:         uint32(len(n.RoutePath) + 1),
	}
}

func healthMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeAdapterData
	m.DataType = mesh.AdapterTypeSerial
	data := make([]byte, 12)
	data[0] = byte(mesh.OpNodeHealth)
	data[1] = byte(n.AdapterType)
	copy(data[2:8], n.MAC[:])
	binary.LittleEndian.PutUint32(data[8:12], n.Uptime)
	m.Data = data
	return m
}

func routeReportMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeRouteReport
	// Protocol v3: relay path is in header fields, not the Data payload.
	m.RouteLen = uint32(len(n.RoutePath))
	if len(n.RoutePath) > 0 {
		routePath := make([]byte, len(n.RoutePath)*6)
		for i, relay := range n.RoutePath {
			copy(routePath[i*6:], relay[:])
		}
		m.RoutePath = routePath
	}
	return m
}

func motionMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeAdapterData
	m.DataType = mesh.AdapterTypePIR
	m.Data = []byte{1}
	return m
}

func enrollmentMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeEnrollment
	m.TargetMacAddress = mesh.BroadcastMACBytes()
	m.PublicKey = append([]byte(nil), n.PublicKey[:]...)
	return m
}

func ackMsg(n *VirtualNode, token [2]byte) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeAdapterData
	m.DataType = mesh.AdapterTypeSerial
	m.Data = []byte{byte(mesh.OpCommandAck), token[0], token[1]}
	return m
}
```

- [ ] **Step 4: Run meshsim tests to verify they pass**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./meshsim/... -v
```

Expected: ALL PASS.

- [ ] **Step 5: Run the full suite**

```bash
cd server/orchestrator && env GOROOT= /opt/homebrew/bin/go test ./...
```

Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
cd server/orchestrator && git add meshsim/frames.go meshsim/sim_test.go meshsim/enrollment_test.go && git commit -m "feat(meshsim): emit ProtoVersion 3; route reports use header fields"
```
