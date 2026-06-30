package mesh

import (
	"sync"
	"time"
)

type CommandStatus string

const (
	CommandStatusPending CommandStatus = "pending"
	CommandStatusAcked   CommandStatus = "acked"
	CommandStatusTimeout CommandStatus = "timeout"
)

type PendingCommand struct {
	ID      string
	NodeID  uint8
	Action  string
	SentAt  time.Time
	Status  CommandStatus
	AckedAt *time.Time
}

type CommandStore struct {
	mu       sync.RWMutex
	commands map[string]*PendingCommand
}

func NewCommandStore() *CommandStore {
	return &CommandStore{commands: make(map[string]*PendingCommand)}
}

func (cs *CommandStore) Add(cmd *PendingCommand) {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cs.commands[cmd.ID] = cmd
}

func (cs *CommandStore) Ack(commandID string) bool {
	cs.mu.Lock()
	defer cs.mu.Unlock()
	cmd, ok := cs.commands[commandID]
	if !ok {
		return false
	}
	now := time.Now()
	cmd.Status = CommandStatusAcked
	cmd.AckedAt = &now
	return true
}

func (cs *CommandStore) Get(commandID string) (*PendingCommand, bool) {
	cs.mu.RLock()
	defer cs.mu.RUnlock()
	cmd, ok := cs.commands[commandID]
	if !ok {
		return nil, false
	}
	c := *cmd
	return &c, true
}
