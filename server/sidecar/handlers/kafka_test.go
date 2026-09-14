// SPDX-License-Identifier: GPL-3.0-or-later

// This file uses the internal "handlers" package (unlike its siblings, which
// use "handlers_test") because it exercises recentEventsReaderConfig, an
// unexported helper. Go supports both an internal and an external test
// package coexisting in one directory.
package handlers

import (
	"testing"
	"time"
)

// RecentEvents' kafka.Reader prefetches: once ReadMessage returns the last
// existing message, the background goroutine has already issued the next
// Fetch, and Close() blocks until that Fetch returns or MaxWait elapses.
// With the kafka-go default (MaxWait unset, i.e. 0 -> library default of
// 10s), Close() — and so the whole HTTP handler — stalls for ~9-10s whenever
// the topic has no newer message. MaxWait must be set short enough that the
// endpoint stays responsive.
func TestRecentEventsReaderConfig_MaxWaitIsShort(t *testing.T) {
	cfg := recentEventsReaderConfig("localhost:9092")

	if cfg.MaxWait <= 0 || cfg.MaxWait > time.Second {
		t.Errorf("MaxWait = %v, want > 0 and <= 1s so reader.Close() cannot block on the prefetch fetch for multiple seconds", cfg.MaxWait)
	}
}
