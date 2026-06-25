package nodeauth

import (
	"sync"
)

// replayKey uniquely identifies a message (sender + epoch + seq).
type replayKey struct {
	mac   [6]byte
	epoch uint32
	seq   uint32
}

// ReplayCache detects replayed messages using a sliding ring buffer per node.
type ReplayCache struct {
	mu    sync.Mutex
	cache []replayKey
	size  int
	idx   int
}

func NewReplayCache(size int) *ReplayCache {
	return &ReplayCache{cache: make([]replayKey, size), size: size}
}

// IsDuplicate returns true if (mac, epoch, seq) was seen recently; records it otherwise.
func (rc *ReplayCache) IsDuplicate(mac [6]byte, epoch, seq uint32) bool {
	rc.mu.Lock()
	defer rc.mu.Unlock()
	k := replayKey{mac: mac, epoch: epoch, seq: seq}
	for _, entry := range rc.cache {
		if entry == k {
			return true
		}
	}
	rc.cache[rc.idx] = k
	rc.idx = (rc.idx + 1) % rc.size
	return false
}
