package meshsim

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

type NodeConfig struct {
	MAC         string   `json:"mac"`
	Name        string   `json:"name"`
	Type        string   `json:"type"`
	RoutePath   []string `json:"routePath"`
	HeartbeatMs int      `json:"heartbeatMs"`
	Silent      bool     `json:"silent"`
}

type Config struct {
	Nodes         []NodeConfig `json:"nodes"`
	RouteReportMs int          `json:"routeReportMs"`
}

func LoadConfig(path string) (*Config, error) {
	if path == "" {
		return &Config{}, nil
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read sim config: %w", err)
	}
	var cfg Config
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return nil, fmt.Errorf("parse sim config: %w", err)
	}
	return &cfg, nil
}

func ParseMAC(s string) ([6]byte, error) {
	var mac [6]byte
	parts := strings.Split(s, ":")
	if len(parts) != 6 {
		return mac, fmt.Errorf("invalid MAC %q", s)
	}
	for i, p := range parts {
		if len(p) != 2 {
			return mac, fmt.Errorf("invalid MAC %q", s)
		}
		var b byte
		if _, err := fmt.Sscanf(p, "%02x", &b); err != nil {
			return mac, fmt.Errorf("invalid MAC %q: %w", s, err)
		}
		mac[i] = b
	}
	return mac, nil
}

func AdapterTypeFromString(s string) (int32, error) {
	switch strings.ToLower(s) {
	case "pir":
		return 2, nil
	case "led":
		return 3, nil
	case "relay":
		return 4, nil
	default:
		return 0, fmt.Errorf("unknown adapter type %q", s)
	}
}
