package meshsim

import (
	"fmt"
	"time"
)

type VirtualNode struct {
	MAC               [6]byte
	MACString         string
	Name              string
	AdapterType       int32
	NodeID            uint8
	RoutePath         [][6]byte
	HeartbeatInterval time.Duration
	Enrolled          bool
	Rejected          bool
	Offline           bool
	Silent            bool
	PublicKey         [32]byte
	Uptime            uint32
	AckCount          int

	lastHeartbeat     time.Time
	lastRouteReport   time.Time
	lastEnrollAttempt time.Time
}

func newNode(macStr, typ string) (*VirtualNode, error) {
	mac, err := ParseMAC(macStr)
	if err != nil {
		return nil, err
	}
	at, err := AdapterTypeFromString(typ)
	if err != nil {
		return nil, err
	}
	return &VirtualNode{
		MAC:               mac,
		MACString:         macStr,
		AdapterType:       at,
		HeartbeatInterval: 3 * time.Second,
		PublicKey:         pubKeyForMAC(mac),
	}, nil
}

// NewSeededNode builds an already-enrolled node from seed config.
func NewSeededNode(nc NodeConfig) (*VirtualNode, error) {
	n, err := newNode(nc.MAC, nc.Type)
	if err != nil {
		return nil, err
	}
	n.Name = nc.Name
	n.Enrolled = true
	n.Silent = nc.Silent
	if nc.HeartbeatMs > 0 {
		n.HeartbeatInterval = time.Duration(nc.HeartbeatMs) * time.Millisecond
	}
	for _, r := range nc.RoutePath {
		rm, err := ParseMAC(r)
		if err != nil {
			return nil, fmt.Errorf("route path: %w", err)
		}
		n.RoutePath = append(n.RoutePath, rm)
	}
	return n, nil
}

// NewEnrollingNode builds an unenrolled node that will broadcast enrollment requests.
func NewEnrollingNode(mac, typ string) (*VirtualNode, error) {
	return newNode(mac, typ)
}

// pubKeyForMAC derives a stable, non-zero 32-byte key from the MAC.
func pubKeyForMAC(mac [6]byte) [32]byte {
	var key [32]byte
	for i := range key {
		key[i] = mac[i%6] ^ byte(i) | 0x01
	}
	return key
}
