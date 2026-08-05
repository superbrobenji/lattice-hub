package mesh

import (
	"bytes"
	"path/filepath"
	"testing"
	"time"
)

// newDualMasterTestMeshServer builds a MeshServer with BOTH primary and
// secondary master identities configured — exercises the dual-master
// JOIN_ACK stamping path (issue #88).
func newDualMasterTestMeshServer(t *testing.T) *MeshServer {
	t.Helper()
	tempDir := t.TempDir()
	cfg := MeshServerConfig{
		SerialPort:             "",
		BaudRate:               115200,
		HealthTimeout:          75 * time.Second,
		EventStore:             NewMockEventStore(),
		AuthRegistryPath:       "",
		NodeRegistryPath:       "",
		MasterKeyPath:          filepath.Join(tempDir, "masterkey.json"),
		MasterMAC:              [6]byte{0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01},
		SecondaryMasterKeyPath: filepath.Join(tempDir, "masterkey-secondary.json"),
		SecondaryMasterMAC:     [6]byte{0xC0, 0xFF, 0xEE, 0xBA, 0x11, 0x02},
	}
	return NewMeshServer(cfg)
}

// TestApproveEnrollment_DualMaster_JoinAckCarriesSecondaryFields is the
// core regression test for issue #88. Firmware Phase 4+5 registers a
// secondary master only when JOIN_ACK carries both non-zero
// SecondaryMasterMac (6B) and SecondaryPublicKey (32B). Before this
// fix, hub had no path to populate either field.
func TestApproveEnrollment_DualMaster_JoinAckCarriesSecondaryFields(t *testing.T) {
	ms := newDualMasterTestMeshServer(t)
	mockPort := NewMockSerialPort()
	ms.serialComm = NewSerialComm(mockPort)

	macStr, _ := enrollTestNode(t, ms)
	if err := ms.ApproveEnrollment(macStr, ApprovalParams{}); err != nil {
		t.Fatalf("ApproveEnrollment returned error: %v", err)
	}

	joinAck := decodeWrittenFrame(t, mockPort)

	if joinAck.MessageType != 4 {
		t.Errorf("MessageType = %d, want 4 (JOIN_ACK)", joinAck.MessageType)
	}
	if joinAck.ProtoVersion != 5 {
		t.Errorf("ProtoVersion = %d, want 5", joinAck.ProtoVersion)
	}

	// v6 wire shrink (design §8): secondary identity is packed into
	// data[4..42] instead of top-level SecondaryMasterMac/SecondaryPublicKey
	// fields (retired in lattice-protocol v0.6.0).
	if len(joinAck.Data) < 42 {
		t.Fatalf("Data length = %d, want at least 42", len(joinAck.Data))
	}

	// data[4..10] must carry the configured secondary MAC (all 6 bytes).
	wantSecMAC := []byte{0xC0, 0xFF, 0xEE, 0xBA, 0x11, 0x02}
	if got := joinAck.Data[4:10]; !bytes.Equal(got, wantSecMAC) {
		t.Errorf("Data[4:10] (secondaryMasterMac) = %x, want %x", got, wantSecMAC)
	}

	// data[10..42] must carry the secondary master's public key (32 bytes).
	gotSecKey := joinAck.Data[10:42]
	if !bytes.Equal(gotSecKey, ms.secondaryMasterPublicKey[:]) {
		t.Errorf("Data[10:42] (secondaryPublicKey) = %x, want %x (secondary master pubkey)",
			gotSecKey[:4], ms.secondaryMasterPublicKey[:4])
	}

	// data[42..64] must remain zero.
	for i, b := range joinAck.Data[42:64] {
		if b != 0 {
			t.Errorf("Data[%d] = %d, want 0 (reserved tail)", 42+i, b)
			break
		}
	}

	// Sanity: primary fields must still be correct (this is not JUST the
	// secondary path — primary + secondary must both be present).
	wantPrimaryMAC := []byte{0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x01}
	if !bytes.Equal(joinAck.OriginMacAddress, wantPrimaryMAC) {
		t.Errorf("OriginMacAddress = %x, want %x (primary master MAC)",
			joinAck.OriginMacAddress, wantPrimaryMAC)
	}
	if !bytes.Equal(joinAck.PublicKey, ms.masterPublicKey[:]) {
		t.Errorf("PublicKey = %x, want primary master pubkey", joinAck.PublicKey[:4])
	}
}

// TestApproveEnrollment_SingleMaster_JoinAckOmitsSecondaryFields verifies
// the default (single-master) path leaves data[4..42] zeroed — firmware
// Phase 4 skips secondary registration when the MAC is zero-valued, so
// an all-zero data[4:10] on the wire is the correct signal.
func TestApproveEnrollment_SingleMaster_JoinAckOmitsSecondaryFields(t *testing.T) {
	ms := newTestMeshServer(t)
	mockPort := NewMockSerialPort()
	ms.serialComm = NewSerialComm(mockPort)

	macStr, _ := enrollTestNode(t, ms)
	if err := ms.ApproveEnrollment(macStr, ApprovalParams{}); err != nil {
		t.Fatalf("ApproveEnrollment returned error: %v", err)
	}

	joinAck := decodeWrittenFrame(t, mockPort)

	if len(joinAck.Data) < 42 {
		t.Fatalf("Data length = %d, want at least 42", len(joinAck.Data))
	}
	zero42 := make([]byte, 38)
	if got := joinAck.Data[4:42]; !bytes.Equal(got, zero42) {
		t.Errorf("single-master JOIN_ACK carried non-zero data[4:42] = %x, want all-zero", got)
	}
}
