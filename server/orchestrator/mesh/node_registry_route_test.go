package mesh

import (
	"testing"
)

func TestUpdateNodeRoute_SetsRoutePath(t *testing.T) {
	nr := NewNodeRegistry()
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	relay1 := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01}
	relay2 := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x02}

	nr.UpdateNodeRoute(origin, [][]byte{relay1, relay2})

	node, ok := nr.GetNode(origin)
	if !ok {
		t.Fatal("origin node not in registry after UpdateNodeRoute")
	}
	if len(node.RoutePath) != 2 {
		t.Fatalf("RoutePath len = %d, want 2", len(node.RoutePath))
	}
	if node.RoutePath[0] != macToString(relay1) {
		t.Errorf("RoutePath[0] = %q, want %q", node.RoutePath[0], macToString(relay1))
	}
}

func TestUpdateNodeRoute_ResolvesParentID(t *testing.T) {
	nr := NewNodeRegistry()
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	relay1 := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01}

	// Pre-register relay1 with a node ID
	nr.AssignNode(relay1, 5, "relay-node", "zone-a")

	nr.UpdateNodeRoute(origin, [][]byte{relay1})

	node, _ := nr.GetNode(origin)
	if node.ParentID == nil {
		t.Fatal("ParentID is nil, want pointer to 5")
	}
	if *node.ParentID != 5 {
		t.Errorf("ParentID = %d, want 5", *node.ParentID)
	}
}

func TestUpdateNodeRoute_ParentIDNilWhenRelayUnknown(t *testing.T) {
	nr := NewNodeRegistry()
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	relay1 := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01}
	// relay1 is NOT in the registry

	nr.UpdateNodeRoute(origin, [][]byte{relay1})

	node, _ := nr.GetNode(origin)
	if node.ParentID != nil {
		t.Errorf("ParentID = %v, want nil (relay not in registry)", *node.ParentID)
	}
}

func TestUpdateNodeRoute_EmptyRelays_NilParentID(t *testing.T) {
	nr := NewNodeRegistry()
	origin := []byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}

	nr.UpdateNodeRoute(origin, [][]byte{})

	node, _ := nr.GetNode(origin)
	if node.ParentID != nil {
		t.Errorf("ParentID = %v, want nil for hop-1 node", *node.ParentID)
	}
	if len(node.RoutePath) != 0 {
		t.Errorf("RoutePath len = %d, want 0", len(node.RoutePath))
	}
}
