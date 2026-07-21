package meshsim

import (
	"testing"
	"time"

	"github.com/superbrobenji/lattice-hub/mesh"
)

func TestSpawnedNodeBroadcastsEnrollment(t *testing.T) {
	sim, orch := newTestSim(t, &Config{})
	if err := sim.SpawnNode("aa:bb:cc:dd:ee:99", "led"); err != nil {
		t.Fatal(err)
	}
	go sim.tick(time.Now().Add(time.Hour))
	msg, err := orch.ReadFrame()
	if err != nil {
		t.Fatal(err)
	}
	if msg.MessageType != uint32(mesh.MessageTypeEnrollment) || len(msg.PublicKey) != 32 {
		t.Fatalf("bad enrollment frame: %+v", msg)
	}
	if macKey(msg.OriginMacAddress) != "aa:bb:cc:dd:ee:99" {
		t.Fatalf("wrong origin: %v", msg.OriginMacAddress)
	}
}

func TestJoinAckApprovesAndStartsHeartbeat(t *testing.T) {
	sim, orch := newTestSim(t, &Config{})
	if err := sim.SpawnNode("aa:bb:cc:dd:ee:99", "led"); err != nil {
		t.Fatal(err)
	}
	n := sim.snapshot()[0]
	ack := &mesh.MeshMessage{MessageType: uint32(mesh.MessageTypeJoinAck), TargetMacAddress: []byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x99}, PublicKey: n.PublicKey[:], ProtoVersion: 3}
	go func() {
		if err := orch.WriteFrame(ack); err != nil {
			t.Error(err)
		}
	}()
	waitFor(t, func() bool { return sim.snapshot()[0].Enrolled })
	go sim.tick(time.Now().Add(time.Hour))
	msg, err := orch.ReadFrame()
	if err != nil {
		t.Fatal(err)
	}
	if msg.Data[0] != byte(mesh.OpNodeHealth) {
		t.Fatalf("expected health after enroll, got %v", msg.Data)
	}
}

func TestJoinAckEmptyKeyRejectsAndStopsBroadcast(t *testing.T) {
	sim, orch := newTestSim(t, &Config{})
	if err := sim.SpawnNode("aa:bb:cc:dd:ee:98", "pir"); err != nil {
		t.Fatal(err)
	}
	rej := &mesh.MeshMessage{MessageType: uint32(mesh.MessageTypeJoinAck), TargetMacAddress: []byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x98}, ProtoVersion: 3}
	go func() {
		if err := orch.WriteFrame(rej); err != nil {
			t.Error(err)
		}
	}()
	waitFor(t, func() bool { return sim.snapshot()[0].Rejected })
	// A tick must now produce NO frames: read with deadline via a goroutine flag.
	wrote := make(chan struct{})
	go func() { sim.tick(time.Now().Add(time.Hour)); close(wrote) }()
	select {
	case <-wrote: // tick completed without blocking on a write — nothing was sent
	case <-time.After(2 * time.Second):
		t.Fatal("tick blocked writing a frame from a rejected node")
	}
}

func TestFireMotion(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	go func() {
		if err := sim.FireMotion("aa:bb:cc:dd:ee:01"); err != nil {
			t.Error(err)
		}
	}()
	msg, err := orch.ReadFrame()
	if err != nil {
		t.Fatal(err)
	}
	if msg.DataType != int32(mesh.AdapterTypePIR) || msg.Data[0] != 1 {
		t.Fatalf("bad motion frame: %+v", msg)
	}
	if err := sim.FireMotion("ff:ff:ff:ff:ff:00"); err == nil {
		t.Fatal("want error for unknown MAC")
	}
}

func TestSpawnNodeDuplicateMAC(t *testing.T) {
	sim, _ := newTestSim(t, &Config{})
	if err := sim.SpawnNode("aa:bb:cc:dd:ee:97", "led"); err != nil {
		t.Fatal(err)
	}
	if err := sim.SpawnNode("aa:bb:cc:dd:ee:97", "led"); err == nil {
		t.Fatal("want error for duplicate MAC")
	}
}

func TestFireMotionErrors(t *testing.T) {
	sim, _ := newTestSim(t, seededCfg())
	// Not enrolled: spawn a fresh node that never got a JoinAck.
	if err := sim.SpawnNode("aa:bb:cc:dd:ee:03", "pir"); err != nil {
		t.Fatal(err)
	}
	if err := sim.FireMotion("aa:bb:cc:dd:ee:03"); err == nil {
		t.Fatal("want error for unenrolled node")
	}
	// Offline: enrolled node that has been taken offline.
	if err := sim.SetOffline("aa:bb:cc:dd:ee:01", true); err != nil {
		t.Fatal(err)
	}
	if err := sim.FireMotion("aa:bb:cc:dd:ee:01"); err == nil {
		t.Fatal("want error for offline node")
	}
}

func TestFireMotionNoComm(t *testing.T) {
	sim := New(seededCfg())
	if err := sim.FireMotion("aa:bb:cc:dd:ee:01"); err == nil {
		t.Fatal("want error when no orchestrator is attached")
	}
}

func waitFor(t *testing.T, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("condition not met")
}
