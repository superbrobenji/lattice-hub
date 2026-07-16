package meshsim

import (
	"encoding/binary"
	"fmt"

	"github.com/superbrobenji/lattice-hub/mesh"
)

func macKey(mac []byte) string {
	if len(mac) < 6 {
		return ""
	}
	return fmt.Sprintf("%02x:%02x:%02x:%02x:%02x:%02x", mac[0], mac[1], mac[2], mac[3], mac[4], mac[5])
}

func envelope(n *VirtualNode) *mesh.MeshMessage {
	return &mesh.MeshMessage{
		ProtoVersion:     2,
		OriginMacAddress: append([]byte(nil), n.MAC[:]...),
		HopCount:         uint32(len(n.RoutePath) + 1),
	}
}

func healthMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeAdapterData
	m.DataType = mesh.AdapterTypeSerial
	data := make([]byte, 12)
	data[0] = byte(mesh.OpNodeHealth)
	data[1] = byte(n.AdapterType)
	copy(data[2:8], n.MAC[:])
	binary.LittleEndian.PutUint32(data[8:12], n.Uptime)
	m.Data = data
	return m
}

func routeReportMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeRouteReport
	data := make([]byte, 2+len(n.RoutePath)*6)
	data[0] = byte(mesh.OpRouteReport)
	data[1] = byte(len(n.RoutePath))
	for i, relay := range n.RoutePath {
		copy(data[2+i*6:], relay[:])
	}
	m.Data = data
	return m
}

func motionMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeAdapterData
	m.DataType = mesh.AdapterTypePIR
	m.Data = []byte{1}
	return m
}

func enrollmentMsg(n *VirtualNode) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeEnrollment
	m.TargetMacAddress = mesh.BroadcastMACBytes()
	m.PublicKey = append([]byte(nil), n.PublicKey[:]...)
	return m
}

func ackMsg(n *VirtualNode, token [2]byte) *mesh.MeshMessage {
	m := envelope(n)
	m.MessageType = mesh.MessageTypeAdapterData
	m.DataType = mesh.AdapterTypeSerial
	m.Data = []byte{byte(mesh.OpCommandAck), token[0], token[1]}
	return m
}
