package mesh

import (
	"fmt"

	"github.com/superbrobenji/lattice-protocol/adapter"
	"github.com/superbrobenji/lattice-protocol/message"
	"github.com/superbrobenji/lattice-protocol/opcodes"
)

// Message Types — canonical values from lattice-protocol/message.
// uint32 cast required: MeshMessage.MessageType (protobuf) is uint32.
const (
	MessageTypeAdapterData        = uint32(message.MeshTypeAdapterData)        // 0
	MessageTypeMasterBeacon       = uint32(message.MeshTypeMasterBeacon)       // 1
	MessageTypeEnrollment         = uint32(message.MeshTypeEnrollment)         // 2
	MessageTypeSerialCmdBroadcast = uint32(message.MeshTypeSerialCmdBroadcast) // 3
	MessageTypeJoinAck            = uint32(message.MeshTypeJoinAck)            // 4
	MessageTypeRouteReport        = uint32(message.MeshTypeRouteReport)        // 5
)

// Adapter type aliases — use shared protocol constants.
// Values: TypeUnknown=0, TypeSerial=1, TypePIR=2, TypeLED=3, TypeRelay=4.
const (
	AdapterTypeUnknown = adapter.TypeUnknown // 0
	AdapterTypeSerial  = adapter.TypeSerial  // 1 — serial management (internal)
	AdapterTypePIR     = adapter.TypePIR     // 2 — passive infrared motion sensor (INPUT)
	AdapterTypeLED     = adapter.TypeLED     // 3 — LED strip (OUTPUT)
	AdapterTypeRelay   = adapter.TypeRelay   // 4 — relay switch (OUTPUT)

	// AdapterTypeWIFI is reserved locally; not part of the shared protocol.
	AdapterTypeWIFI int32 = 5 // reserved
)

// Serial Control Opcodes (only when dataType = SERIAL)
// Shared opcodes are imported from the protocol package.
const (
	OpNodeIdSet  = opcodes.OpNodeIdSet  // 0xC0 — Server → node: assign logical node ID
	OpConfigSet  = opcodes.OpConfigSet  // 0xC1 — Server → node: set adapter type and config
	OpTxPowerSet = opcodes.OpTxPowerSet // 0xC2 — Server → node: set TX power preset

	// Health opcodes — shared with firmware via lattice-protocol.
	OpHealthReq    = opcodes.OpHealthReq    // 0xB0 — server → node: request health report
	OpHealthReport = opcodes.OpHealthReport // 0xB1 — node (serial) → server: health status
	OpNodeHealth   = opcodes.OpNodeHealth   // 0xB2 — node (non-serial) → server: health via serial adapter

	// Ack opcode — mirrors opcodes.OpCommandAck (0xE0) from the shared protocol.
	OpCommandAck = opcodes.OpCommandAck // Node → server: acknowledge a received command
)

// Output adapter command opcodes — aliases from lattice-protocol/opcodes.
const (
	OpLEDSolid    = opcodes.OpLEDSolid   // 0xD0
	OpLEDOff      = opcodes.OpLEDOff     // 0xD1
	OpRelaySet    = opcodes.OpRelaySet   // 0xD8
	OpRouteReport = opcodes.OpRouteReport // 0xB3
)

// Broadcast MAC address (all FF bytes)
var broadcastMAC = []byte{0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF}

// BroadcastMACBytes returns a copy of the broadcast MAC address.
func BroadcastMACBytes() []byte {
	cp := make([]byte, MACAddressLength)
	copy(cp, broadcastMAC)
	return cp
}

// MAC address length
const MACAddressLength = 6

// Maximum data payload length
const MaxDataLength = 64

// GetAdapterTypeName returns a human-readable name for an adapter type.
func GetAdapterTypeName(adapterType int32) string {
	switch adapterType {
	case AdapterTypeUnknown:
		return "Unknown"
	case AdapterTypeSerial:
		return "Serial"
	case AdapterTypePIR:
		return "PIR"
	case AdapterTypeLED:
		return "LED"
	case AdapterTypeRelay:
		return "Relay"
	case AdapterTypeWIFI:
		return "WiFi"
	default:
		return fmt.Sprintf("Unknown(%d)", adapterType)
	}
}
