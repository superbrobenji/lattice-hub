package mesh

import (
	"encoding/binary"
	"testing"

	"google.golang.org/protobuf/proto"
)

func TestSetTxPowerPreset_SendsProtoFrame(t *testing.T) {
	ms := newTestMeshServer(t)
	mockPort := NewMockSerialPort()
	ms.serialComm = NewSerialComm(mockPort)

	if err := ms.SetTxPowerPreset(1); err != nil {
		t.Fatalf("SetTxPowerPreset(1) returned error: %v", err)
	}

	data := mockPort.GetWrittenData()
	if len(data) < 2 {
		t.Fatalf("no frame written: only %d bytes", len(data))
	}
	length := int(binary.LittleEndian.Uint16(data[:2]))
	if len(data) < 2+length {
		t.Fatalf("frame truncated: need %d bytes after header, have %d", length, len(data)-2)
	}

	var msg MeshMessage
	if err := proto.Unmarshal(data[2:2+length], &msg); err != nil {
		t.Fatalf("frame is not valid protobuf: %v — WriteRaw was used instead of WriteFrame", err)
	}

	if msg.MessageType != MessageTypeAdapterData {
		t.Errorf("MessageType = %d, want %d (MessageTypeAdapterData)", msg.MessageType, MessageTypeAdapterData)
	}
	if msg.DataType != AdapterTypeSerial {
		t.Errorf("DataType = %d, want %d (AdapterTypeSerial)", msg.DataType, AdapterTypeSerial)
	}
	if len(msg.Data) == 0 || msg.Data[0] != OpTxPowerSet {
		t.Errorf("Data[0] = %d, want %d (OpTxPowerSet)", msg.Data[0], OpTxPowerSet)
	}
	if len(msg.Data) < 2 || msg.Data[1] != 1 {
		t.Errorf("Data[1] = %d, want 1 (preset)", msg.Data[1])
	}
}

func TestSetTxPowerPreset_InvalidPreset_ReturnsError(t *testing.T) {
	ms := newTestMeshServer(t)
	if err := ms.SetTxPowerPreset(3); err == nil {
		t.Error("expected error for preset=3, got nil")
	}
}
