package mesh

import (
	"encoding/binary"
	"fmt"
	"io"
	"log/slog"
	"net"
	"strings"
	"time"

	"go.bug.st/serial"
	"google.golang.org/protobuf/proto"
)

// SerialPort interface for serial communication
type SerialPort interface {
	io.ReadWriter
	Close() error
	Flush() error
}

// realSerialPort wraps go.bug.st/serial Port to satisfy SerialPort interface.
type realSerialPort struct {
	serial.Port
}

func (p *realSerialPort) Flush() error {
	return p.ResetInputBuffer()
}

// tcpPort adapts a net.Conn to the SerialPort interface (mesh simulator link).
type tcpPort struct{ net.Conn }

func (t *tcpPort) Flush() error { return nil }

// openTransport opens the configured mesh transport. A spec beginning with
// "tcp://" dials a TCP stream (used by the stub-mode mesh simulator, which
// may still be starting — hence the retry loop); anything else is a serial
// device path.
func openTransport(spec string, mode *serial.Mode) (SerialPort, error) {
	if addr, ok := strings.CutPrefix(spec, "tcp://"); ok {
		var lastErr error
		for range 30 {
			conn, err := net.DialTimeout("tcp", addr, 2*time.Second)
			if err == nil {
				return &tcpPort{conn}, nil
			}
			lastErr = err
			time.Sleep(time.Second)
		}
		return nil, fmt.Errorf("dial mesh sim %s: %w", spec, lastErr)
	}
	rawPort, err := serial.Open(spec, mode)
	if err != nil {
		return nil, err
	}
	return &realSerialPort{rawPort}, nil
}

// SerialComm handles serial communication with framing
type SerialComm struct {
	port SerialPort
}

// NewSerialComm creates a new serial communication handler
func NewSerialComm(port SerialPort) *SerialComm {
	return &SerialComm{port: port}
}

// WriteFrame writes a protobuf message with 2-byte little-endian length prefix
func (s *SerialComm) WriteFrame(msg *MeshMessage) error {
	slog.Debug("Serial TX", "type", msg.MessageType, "dataType", msg.DataType, "dataLen", len(msg.Data))

	// Marshal the protobuf message
	data, err := proto.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Create 2-byte little-endian length header
	header := make([]byte, 2)
	binary.LittleEndian.PutUint16(header, uint16(len(data)))

	// Write header
	if _, err := s.port.Write(header); err != nil {
		return fmt.Errorf("failed to write header: %w", err)
	}

	// Write data
	if _, err := s.port.Write(data); err != nil {
		return fmt.Errorf("failed to write data: %w", err)
	}

	return nil
}

// ReadFrame reads a protobuf message with 2-byte little-endian length prefix
func (s *SerialComm) ReadFrame() (*MeshMessage, error) {
	// Read 2-byte header
	header := make([]byte, 2)
	if _, err := io.ReadFull(s.port, header); err != nil {
		return nil, fmt.Errorf("failed to read header: %w", err)
	}

	// Parse length
	length := binary.LittleEndian.Uint16(header)
	if length == 0 {
		return nil, fmt.Errorf("invalid frame length: 0 (header bytes: %02x %02x)", header[0], header[1])
	}

	if length > 4096 {
		slog.Warn("Frame length too large — possible desync", "length", length, "header", fmt.Sprintf("%02x %02x", header[0], header[1]))
		// Try to recover by reading and discarding some bytes
		discardBuf := make([]byte, 100)
		if n, err := s.port.Read(discardBuf); err == nil {
			slog.Debug("Discarded bytes for recovery", "count", n)
		}
		return nil, fmt.Errorf("frame length too large: %d (header bytes: %02x %02x)", length, header[0], header[1])
	}

	if length > 200 {
		slog.Debug("Large frame detected", "length", length)
	}

	slog.Debug("Serial RX frame", "length", length)

	// Read data
	data := make([]byte, length)
	if _, err := io.ReadFull(s.port, data); err != nil {
		return nil, fmt.Errorf("failed to read data: %w", err)
	}

	// Unmarshal protobuf message
	var msg MeshMessage
	if err := proto.Unmarshal(data, &msg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal message: %w", err)
	}

	slog.Debug("Serial RX parsed", "type", msg.MessageType, "dataType", msg.DataType, "hops", msg.HopCount)

	return &msg, nil
}

// Close closes the serial port
func (s *SerialComm) Close() error {
	return s.port.Close()
}

// FlushBuffer attempts to clear any buffered data from the serial port
func (s *SerialComm) FlushBuffer() error {
	slog.Debug("Flushing serial buffer")
	if err := s.port.Flush(); err != nil {
		slog.Debug("Flush failed", "error", err)
	}
	return nil
}
