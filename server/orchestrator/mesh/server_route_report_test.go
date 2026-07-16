package mesh

import (
	"testing"
)

func buildRouteReportMsg(originMAC []byte, relayMACs [][]byte) *MeshMessage {
	data := make([]byte, MaxDataLength)
	data[0] = OpRouteReport
	data[1] = byte(len(relayMACs))
	for i, mac := range relayMACs {
		copy(data[2+i*MACAddressLength:], mac)
	}
	return &MeshMessage{
		MessageType:      MessageTypeRouteReport,
		OriginMacAddress: originMAC,
		Data:             data,
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

func TestHandleRouteReport_BadOpcode_Discards(t *testing.T) {
	ms := newTestMeshServer(t)
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	data := make([]byte, MaxDataLength)
	data[0] = 0xFF // wrong opcode
	data[1] = 0
	msg := &MeshMessage{
		MessageType:      MessageTypeRouteReport,
		OriginMacAddress: origin,
		Data:             data,
	}
	if err := ms.handleRouteReport(msg); err != nil {
		t.Errorf("expected nil error on discard, got %v", err)
	}
	_, ok := ms.nodeRegistry.GetNode(origin)
	if ok {
		t.Error("origin should not be in registry after bad-opcode discard")
	}
}

func TestHandleRouteReport_PathLenTooLarge_Discards(t *testing.T) {
	ms := newTestMeshServer(t)
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	data := make([]byte, MaxDataLength)
	data[0] = OpRouteReport
	data[1] = 11 // > 10, too large
	msg := &MeshMessage{
		MessageType:      MessageTypeRouteReport,
		OriginMacAddress: origin,
		Data:             data,
	}
	if err := ms.handleRouteReport(msg); err != nil {
		t.Errorf("expected nil error on discard, got %v", err)
	}
	_, ok := ms.nodeRegistry.GetNode(origin)
	if ok {
		t.Error("origin should not be in registry after oversized path_len discard")
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
