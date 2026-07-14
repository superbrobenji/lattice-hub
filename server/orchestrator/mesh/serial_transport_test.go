package mesh

import (
	"net"
	"testing"

	"go.bug.st/serial"
)

func TestOpenTransportTCPRoundTrip(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close() //nolint:errcheck

	echoed := make(chan *MeshMessage, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		comm := NewSerialComm(&tcpPort{conn})
		msg, err := comm.ReadFrame()
		if err != nil {
			return
		}
		echoed <- msg
	}()

	port, err := openTransport("tcp://"+ln.Addr().String(), nil)
	if err != nil {
		t.Fatalf("openTransport: %v", err)
	}
	defer port.Close() //nolint:errcheck

	comm := NewSerialComm(port)
	want := &MeshMessage{MessageType: MessageTypeRouteReport, OriginMacAddress: []byte{1, 2, 3, 4, 5, 6}, ProtoVersion: 2}
	if err := comm.WriteFrame(want); err != nil {
		t.Fatalf("WriteFrame: %v", err)
	}
	got := <-echoed
	if got.MessageType != want.MessageType || got.ProtoVersion != 2 {
		t.Fatalf("frame mismatch: got %+v", got)
	}
}

func TestOpenTransportDevicePathError(t *testing.T) {
	if _, err := openTransport("/nonexistent-device", &serial.Mode{BaudRate: 115200}); err == nil {
		t.Fatal("expected error for missing device")
	}
}
