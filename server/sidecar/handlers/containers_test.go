package handlers_test

import (
	"testing"

	"github.com/superbrobenji/lattice-hub/sidecar/handlers"
)

func TestIsSecretEnvKey(t *testing.T) {
	cases := []struct {
		key      string
		expected bool
	}{
		{"API_KEY", true},
		{"ADMIN_KEY", true},
		{"SECRET_VALUE", true},
		{"DB_PASSWORD", true},
		{"AUTH_TOKEN", true},
		{"KAFKA_BROKER", false},
		{"PORT", false},
		{"NODE_ENV", false},
	}
	for _, c := range cases {
		got := handlers.IsSecretEnvKey(c.key)
		if got != c.expected {
			t.Errorf("IsSecretEnvKey(%q) = %v, want %v", c.key, got, c.expected)
		}
	}
}
