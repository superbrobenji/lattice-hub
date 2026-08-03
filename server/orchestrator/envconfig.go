package main

import (
	"encoding/hex"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
)

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func envOrDefaultInt(key string, def int) int {
	v := os.Getenv(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		slog.Warn("Invalid env var value, using default", "key", key, "value", v, "default", def)
		return def
	}
	return n
}

func parseMAC(s string) ([6]byte, error) {
	var mac [6]byte
	cleaned := strings.ReplaceAll(strings.ReplaceAll(s, ":", ""), "-", "")
	if len(cleaned) != 12 {
		return mac, fmt.Errorf("MAC must be 6 bytes (12 hex chars), got %d hex chars", len(cleaned))
	}
	decoded, err := hex.DecodeString(cleaned)
	if err != nil {
		return mac, fmt.Errorf("invalid hex in MAC: %w", err)
	}
	copy(mac[:], decoded)
	return mac, nil
}

func loadMasterIdentity() (keyPath string, mac [6]byte) {
	keyPath = envOrDefault("MASTER_KEY_PATH", "data/masterkey.json")
	mac = envMAC("MASTER_MAC")
	return
}

func envMAC(key string) [6]byte {
	v := os.Getenv(key)
	if v == "" {
		slog.Warn("Master MAC not configured — JOIN_ACK OriginMacAddress will be all-zero and firmware will reject enrollments",
			"env", key, "action", "set MASTER_MAC=aa:bb:cc:dd:ee:ff to the master ESP32's WiFi MAC")
		return [6]byte{}
	}
	mac, err := parseMAC(v)
	if err != nil {
		slog.Error("Invalid MAC env value — enrollments will fail", "key", key, "value", v, "error", err)
		return [6]byte{}
	}
	return mac
}
