package meshsim

import (
	"encoding/binary"
	"net"
	"testing"
	"time"

	"github.com/superbrobenji/lattice-hub/mesh"
)

type pipePort struct{ net.Conn }

func (p *pipePort) Flush() error { return nil }

// newTestSim wires a Simulator to an in-memory pipe and returns the
// "orchestrator side" comm for driving/observing it.
func newTestSim(t *testing.T, cfg *Config) (*Simulator, *mesh.SerialComm) {
	t.Helper()
	orchEnd, simEnd := net.Pipe()
	t.Cleanup(func() { orchEnd.Close(); simEnd.Close() }) //nolint:errcheck
	sim := New(cfg)
	sim.attachComm(mesh.NewSerialComm(&pipePort{simEnd}))
	return sim, mesh.NewSerialComm(&pipePort{orchEnd})
}

func seededCfg() *Config {
	return &Config{Nodes: []NodeConfig{
		{MAC: "aa:bb:cc:dd:ee:01", Name: "Entrance-PIR", Type: "pir", HeartbeatMs: 3000},
		{MAC: "aa:bb:cc:dd:ee:02", Name: "Hallway-LED", Type: "led", RoutePath: []string{"aa:bb:cc:dd:ee:01"}, HeartbeatMs: 3000},
	}, RouteReportMs: 6000}
}

func TestHealthFrameLayout(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	go sim.tick(time.Now().Add(time.Hour)) // everything overdue → health frames fire

	// First frames on a fresh tick are one health per node (map order varies).
	seen := map[string]*mesh.MeshMessage{}
	for range 2 {
		msg, err := orch.ReadFrame()
		if err != nil {
			t.Fatal(err)
		}
		if msg.MessageType == uint32(mesh.MessageTypeAdapterData) && msg.Data[0] == byte(mesh.OpNodeHealth) {
			seen[macKey(msg.OriginMacAddress)] = msg
		}
	}
	led := seen["aa:bb:cc:dd:ee:02"]
	if led == nil {
		t.Fatal("no health frame from LED node")
		return
	}
	if led.DataType != int32(mesh.AdapterTypeSerial) || led.ProtoVersion != 3 || led.EpochNum != 0 {
		t.Fatalf("bad envelope: %+v", led)
	}
	if len(led.Data) < 12 || led.Data[1] != 3 {
		t.Fatalf("bad payload: %v", led.Data)
	}
	if led.HopCount != 2 { // one relay + 1
		t.Fatalf("hopCount = %d, want 2", led.HopCount)
	}
	if got := led.Data[2:8]; got[5] != 0x02 {
		t.Fatalf("payload MAC wrong: %v", got)
	}
	_ = binary.LittleEndian.Uint32(led.Data[8:12]) // uptime parses
}

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
		return
	}
	// Protocol v3: path is in header fields, not Data[].
	if route.RouteLen == nil || *route.RouteLen != 1 {
		t.Fatalf("RouteLen = %v, want 1", route.RouteLen)
	}
	if len(route.RoutePath) < mesh.MACAddressLength {
		t.Fatalf("RoutePath too short: %v", route.RoutePath)
	}
	if route.RoutePath[5] != 0x01 { // relay MAC last byte: aa:bb:cc:dd:ee:01
		t.Fatalf("relay MAC wrong: %v", route.RoutePath[:6])
	}
}

func TestCommandAckEchoesToken(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	payload := make([]byte, mesh.MaxDataLength)
	payload[0] = byte(mesh.OpLEDSolid)
	payload[62], payload[63] = 0xCA, 0xFE
	cmd := &mesh.MeshMessage{
		MessageType:  uint32(mesh.MessageTypeSerialCmdBroadcast),
		DataType:     int32(mesh.AdapterTypeLED),
		Data:         payload,
		ProtoVersion: 3,
	}
	go func() {
		if err := orch.WriteFrame(cmd); err != nil {
			t.Error(err)
		}
	}()
	ack, err := orch.ReadFrame()
	if err != nil {
		t.Fatal(err)
	}
	if ack.Data[0] != byte(mesh.OpCommandAck) || ack.Data[1] != 0xCA || ack.Data[2] != 0xFE {
		t.Fatalf("bad ack: %v", ack.Data)
	}
	if macKey(ack.OriginMacAddress) != "aa:bb:cc:dd:ee:02" {
		t.Fatalf("ack from wrong node: %v", ack.OriginMacAddress)
	}
	if got := sim.snapshot()[1].AckCount; got != 1 {
		t.Fatalf("AckCount = %d", got)
	}
	// PIR node must NOT ack an LED command; offline nodes must not ack either.
}

func TestOfflineNodeDoesNotAck(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	if err := sim.SetOffline("aa:bb:cc:dd:ee:02", true); err != nil {
		t.Fatal(err)
	}
	payload := make([]byte, mesh.MaxDataLength)
	payload[0] = byte(mesh.OpLEDSolid)
	cmd := &mesh.MeshMessage{MessageType: uint32(mesh.MessageTypeSerialCmdBroadcast), DataType: int32(mesh.AdapterTypeLED), Data: payload, ProtoVersion: 3}
	go orch.WriteFrame(cmd) //nolint:errcheck
	// Force a tick afterwards; the only frames should be health/route from the PIR node, no 0xE0.
	go sim.tick(time.Now().Add(time.Hour))
	for range 2 {
		msg, err := orch.ReadFrame()
		if err != nil {
			t.Fatal(err)
		}
		if len(msg.Data) > 0 && msg.Data[0] == byte(mesh.OpCommandAck) {
			t.Fatal("offline node acked")
		}
	}
}

func TestHealthReqMakesAllNodesReport(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	req := &mesh.MeshMessage{MessageType: uint32(mesh.MessageTypeSerialCmdBroadcast), DataType: int32(mesh.AdapterTypeSerial), Data: []byte{byte(mesh.OpHealthReq)}, ProtoVersion: 3}
	go orch.WriteFrame(req)           //nolint:errcheck
	time.Sleep(50 * time.Millisecond) // let HandleFrame mark nodes due
	go sim.tick(time.Now())
	healths := 0
	for range 4 {
		msg, err := orch.ReadFrame()
		if err != nil {
			t.Fatal(err)
		}
		if len(msg.Data) > 0 && msg.Data[0] == byte(mesh.OpNodeHealth) {
			healths++
		}
	}
	if healths != 2 {
		t.Fatalf("healths = %d, want 2", healths)
	}
}
