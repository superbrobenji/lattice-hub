package meshsim

import (
	"context"
	"fmt"
	"log/slog"
	"net"
	"sort"
	"sync"
	"time"

	"github.com/superbrobenji/lattice-hub/mesh"
)

const (
	tickInterval   = 250 * time.Millisecond
	enrollInterval = 2 * time.Second
)

type connPort struct{ net.Conn }

func (c *connPort) Flush() error { return nil }

type Simulator struct {
	mu                  sync.Mutex
	cfg                 *Config
	nodes               map[string]*VirtualNode
	comm                *mesh.SerialComm
	routeReportInterval time.Duration
	startedAt           time.Time
}

func New(cfg *Config) *Simulator {
	s := &Simulator{cfg: cfg, startedAt: time.Now()}
	s.routeReportInterval = 6 * time.Second
	if cfg.RouteReportMs > 0 {
		s.routeReportInterval = time.Duration(cfg.RouteReportMs) * time.Millisecond
	}
	s.mu.Lock()
	s.resetLocked()
	s.mu.Unlock()
	return s
}

func (s *Simulator) resetLocked() {
	s.nodes = map[string]*VirtualNode{}
	for _, nc := range s.cfg.Nodes {
		n, err := NewSeededNode(nc)
		if err != nil {
			slog.Error("invalid seed node", "mac", nc.MAC, "err", err)
			continue
		}
		s.nodes[n.MACString] = n
	}
}

// Reset restores the seed state, discarding spawned nodes and runtime flags.
func (s *Simulator) Reset() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.resetLocked()
}

// ServeSerial accepts orchestrator connections; a new connection replaces
// the previous one (orchestrator restart).
func (s *Simulator) ServeSerial(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		slog.Info("orchestrator connected", "remote", conn.RemoteAddr())
		comm := mesh.NewSerialComm(&connPort{conn})
		s.attachComm(comm)
	}
}

func (s *Simulator) attachComm(comm *mesh.SerialComm) {
	s.mu.Lock()
	s.comm = comm
	s.mu.Unlock()
	go s.readLoop(comm)
}

func (s *Simulator) readLoop(comm *mesh.SerialComm) {
	for {
		msg, err := comm.ReadFrame()
		if err != nil {
			s.mu.Lock()
			if s.comm == comm {
				s.comm = nil
			}
			s.mu.Unlock()
			slog.Info("orchestrator disconnected", "err", err)
			return
		}
		s.HandleFrame(msg)
	}
}

// Run drives time-based behavior until ctx is cancelled.
func (s *Simulator) Run(ctx context.Context) {
	t := time.NewTicker(tickInterval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case now := <-t.C:
			s.tick(now)
		}
	}
}

func (s *Simulator) tick(now time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.comm == nil {
		return
	}
	// Two passes: all due health frames first, then all due route reports.
	// Interleaving the two per-node would mean the first frames on a fresh
	// tick are health+route for one (randomly chosen) node rather than one
	// health frame per node, which callers rely on.
	for _, n := range s.nodes {
		if n.Offline {
			continue
		}
		if !n.Enrolled {
			if !n.Rejected && now.Sub(n.lastEnrollAttempt) >= enrollInterval {
				n.lastEnrollAttempt = now
				s.writeLocked(enrollmentMsg(n))
			}
			continue
		}
		if n.Silent {
			continue
		}
		if now.Sub(n.lastHeartbeat) >= n.HeartbeatInterval {
			n.lastHeartbeat = now
			n.Uptime = uint32(now.Sub(s.startedAt).Seconds())
			s.writeLocked(healthMsg(n))
		}
	}
	for _, n := range s.nodes {
		if n.Offline || !n.Enrolled || n.Silent {
			continue
		}
		if now.Sub(n.lastRouteReport) >= s.routeReportInterval {
			n.lastRouteReport = now
			s.writeLocked(routeReportMsg(n))
		}
	}
}

func (s *Simulator) writeLocked(msg *mesh.MeshMessage) {
	if s.comm == nil {
		return
	}
	if err := s.comm.WriteFrame(msg); err != nil {
		slog.Warn("write frame failed", "err", err)
	}
}

// HandleFrame processes a frame from the orchestrator.
func (s *Simulator) HandleFrame(msg *mesh.MeshMessage) {
	s.mu.Lock()
	defer s.mu.Unlock()
	switch msg.MessageType {
	case mesh.MessageTypeJoinAck:
		n, ok := s.nodes[macKey(msg.TargetMacAddress)]
		if !ok {
			return
		}
		if len(msg.PublicKey) == 32 {
			n.Enrolled, n.Rejected = true, false
			n.lastHeartbeat, n.lastRouteReport = time.Time{}, time.Time{}
			slog.Info("node enrolled", "mac", n.MACString)
		} else {
			n.Rejected = true
			slog.Info("node rejected", "mac", n.MACString)
		}
	case mesh.MessageTypeAdapterData, mesh.MessageTypeSerialCmdBroadcast:
		if len(msg.Data) == 0 {
			return
		}
		switch msg.DataType {
		case mesh.AdapterTypeSerial:
			s.handleSerialOpLocked(msg)
		case mesh.AdapterTypeLED, mesh.AdapterTypeRelay:
			if len(msg.Data) < mesh.MaxDataLength {
				return
			}
			token := [2]byte{msg.Data[mesh.MaxDataLength-2], msg.Data[mesh.MaxDataLength-1]}
			for _, n := range s.nodes {
				if n.Enrolled && !n.Offline && n.AdapterType == msg.DataType {
					n.AckCount++
					s.writeLocked(ackMsg(n, token))
				}
			}
		}
	}
}

func (s *Simulator) handleSerialOpLocked(msg *mesh.MeshMessage) {
	switch msg.Data[0] {
	case mesh.OpHealthReq:
		for _, n := range s.nodes {
			n.lastHeartbeat = time.Time{}
		}
	case mesh.OpNodeIdSet:
		if len(msg.Data) < 8 {
			return
		}
		if n, ok := s.nodes[macKey(msg.Data[1:7])]; ok {
			n.NodeID = msg.Data[7]
		}
	case mesh.OpConfigSet:
		if len(msg.Data) < 8 {
			return
		}
		if n, ok := s.nodes[macKey(msg.Data[1:7])]; ok {
			n.AdapterType = int32(msg.Data[7])
		}
	}
	// OpTxPowerSet and anything else: ignore.
}

// SpawnNode adds an unenrolled node that immediately starts broadcasting
// enrollment requests.
func (s *Simulator) SpawnNode(mac, typ string) error {
	n, err := NewEnrollingNode(mac, typ)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.nodes[n.MACString]; exists {
		return fmt.Errorf("node %s already exists", mac)
	}
	s.nodes[n.MACString] = n
	return nil
}

// FireMotion sends a PIR motion frame from the given node.
func (s *Simulator) FireMotion(mac string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.nodes[mac]
	if !ok {
		return fmt.Errorf("node %s not found", mac)
	}
	if !n.Enrolled || n.Offline {
		return fmt.Errorf("node %s cannot send motion (enrolled=%v offline=%v)", mac, n.Enrolled, n.Offline)
	}
	if s.comm == nil {
		return fmt.Errorf("orchestrator not connected")
	}
	s.writeLocked(motionMsg(n))
	return nil
}

// SetOffline flips a node's power state. Offline nodes send nothing and ack nothing.
func (s *Simulator) SetOffline(mac string, offline bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	n, ok := s.nodes[mac]
	if !ok {
		return fmt.Errorf("meshsim: node not found: %s", mac)
	}
	n.Offline = offline
	return nil
}

// snapshot returns a stable-ordered copy of node state for tests/control API.
func (s *Simulator) snapshot() []VirtualNode {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]VirtualNode, 0, len(s.nodes))
	for _, n := range s.nodes {
		out = append(out, *n)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].MACString < out[j].MACString })
	return out
}
