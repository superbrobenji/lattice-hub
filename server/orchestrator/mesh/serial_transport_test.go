package mesh

import (
	"net"
	"testing"
	"time"

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
	want := &MeshMessage{MessageType: MessageTypeRouteReport, OriginMacAddress: []byte{1, 2, 3, 4, 5, 6}, ProtoVersion: 4}
	if err := comm.WriteFrame(want); err != nil {
		t.Fatalf("WriteFrame: %v", err)
	}
	got := <-echoed
	if got.MessageType != want.MessageType || got.ProtoVersion != 4 {
		t.Fatalf("frame mismatch: got %+v", got)
	}
}

func TestOpenTransportDevicePathError(t *testing.T) {
	if _, err := openTransport("/nonexistent-device", &serial.Mode{BaudRate: 115200}); err == nil {
		t.Fatal("expected error for missing device")
	}
}

// TestWriteFrame_TCPDeadlineExpires_ReturnsError pairs a real TCP connection
// with a peer that accepts but never reads. Once the kernel send/receive
// buffers fill, Write blocks; WriteFrame's 2s write deadline (added for
// #64 — meshsim writeLocked deadlock) must surface a deadline-exceeded
// error instead of hanging forever.
func TestWriteFrame_TCPDeadlineExpires_ReturnsError(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer ln.Close() //nolint:errcheck

	peerConn := make(chan net.Conn, 1)
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		peerConn <- conn
		// Deliberately never read — simulates a stalled TCP peer.
	}()

	port, err := openTransport("tcp://"+ln.Addr().String(), nil)
	if err != nil {
		t.Fatalf("openTransport: %v", err)
	}
	defer port.Close() //nolint:errcheck

	conn := <-peerConn
	defer conn.Close() //nolint:errcheck

	comm := NewSerialComm(port)
	data := make([]byte, 1500) // large enough to fill kernel buffers in a handful of writes

	start := time.Now()
	guard := time.After(8 * time.Second)
	var writeErr error
loop:
	for {
		select {
		case <-guard:
			break loop
		default:
		}
		writeErr = comm.WriteFrame(&MeshMessage{MessageType: MessageTypeRouteReport, Data: data})
		if writeErr != nil {
			break
		}
	}
	elapsed := time.Since(start)

	if writeErr == nil {
		t.Fatal("expected WriteFrame to eventually return a deadline error after filling the send buffer, got nil")
	}
	if elapsed > 6*time.Second {
		t.Fatalf("WriteFrame took %v to fail — 2s write deadline doesn't appear to be applied", elapsed)
	}
	t.Logf("WriteFrame failed after %v filling buffers: %v", elapsed, writeErr)
}
