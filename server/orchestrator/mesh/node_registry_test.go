package mesh

import (
	"testing"
)

func TestAssignNode_EmptyName_DefaultsToMACString(t *testing.T) {
	nr := NewNodeRegistry()
	mac := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x01}
	nr.AssignNode(mac, 1, "", "")
	node, ok := nr.GetNode(mac)
	if !ok {
		t.Fatalf("AssignNode did not register node")
	}
	if node.Name != macToString(mac) {
		t.Errorf("Name = %q, want %q (MAC fallback)", node.Name, macToString(mac))
	}
}

func TestAssignNode_ExplicitName_Preserved(t *testing.T) {
	nr := NewNodeRegistry()
	mac := []byte{0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0x02}
	nr.AssignNode(mac, 2, "kitchen-motion", "kitchen")
	node, ok := nr.GetNode(mac)
	if !ok {
		t.Fatalf("AssignNode did not register node")
	}
	if node.Name != "kitchen-motion" {
		t.Errorf("Name = %q, want %q (preserved)", node.Name, "kitchen-motion")
	}
}
