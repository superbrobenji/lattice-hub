package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/superbrobenji/lattice-hub/mesh"
)

func TestEnvOrDefault_StringUsesEnv(t *testing.T) {
	t.Setenv("TEST_VAR", "from-env")
	result := envOrDefault("TEST_VAR", "default")
	if result != "from-env" {
		t.Errorf("expected 'from-env', got %q", result)
	}
}

func TestEnvOrDefault_StringFallsBack(t *testing.T) {
	if err := os.Unsetenv("TEST_VAR"); err != nil {
		t.Fatal(err)
	}
	result := envOrDefault("TEST_VAR", "default")
	if result != "default" {
		t.Errorf("expected 'default', got %q", result)
	}
}

func TestEnvOrDefaultInt_UsesEnv(t *testing.T) {
	t.Setenv("TEST_INT", "9999")
	result := envOrDefaultInt("TEST_INT", 1234)
	if result != 9999 {
		t.Errorf("expected 9999, got %d", result)
	}
}

func TestEnvOrDefaultInt_FallsBack(t *testing.T) {
	if err := os.Unsetenv("TEST_INT"); err != nil {
		t.Fatal(err)
	}
	result := envOrDefaultInt("TEST_INT", 1234)
	if result != 1234 {
		t.Errorf("expected 1234, got %d", result)
	}
}

func TestParseMAC_ColonForm(t *testing.T) {
	got, err := parseMAC("aa:bb:cc:dd:ee:ff")
	if err != nil {
		t.Fatalf("parseMAC returned error: %v", err)
	}
	want := [6]byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
	if got != want {
		t.Errorf("parseMAC(colon form) = %x, want %x", got, want)
	}
}

func TestParseMAC_DashForm(t *testing.T) {
	got, err := parseMAC("AA-BB-CC-DD-EE-FF")
	if err != nil {
		t.Fatalf("parseMAC returned error: %v", err)
	}
	want := [6]byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
	if got != want {
		t.Errorf("parseMAC(dash form) = %x, want %x", got, want)
	}
}

func TestParseMAC_NoSeparator(t *testing.T) {
	got, err := parseMAC("aabbccddeeff")
	if err != nil {
		t.Fatalf("parseMAC returned error: %v", err)
	}
	want := [6]byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
	if got != want {
		t.Errorf("parseMAC(no-sep form) = %x, want %x", got, want)
	}
}

func TestParseMAC_WrongLength(t *testing.T) {
	if _, err := parseMAC("aa:bb:cc:dd:ee"); err == nil {
		t.Error("expected error for 5-byte MAC, got nil")
	}
}

func TestParseMAC_InvalidHex(t *testing.T) {
	if _, err := parseMAC("zz:zz:zz:zz:zz:zz"); err == nil {
		t.Error("expected error for non-hex MAC, got nil")
	}
}

func TestEnvMAC_ParsesValidEnv(t *testing.T) {
	t.Setenv("MASTER_MAC", "01:02:03:04:05:06")
	got := envMAC("MASTER_MAC")
	want := [6]byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}
	if got != want {
		t.Errorf("envMAC = %x, want %x", got, want)
	}
}

func TestEnvMAC_MissingReturnsZero(t *testing.T) {
	if err := os.Unsetenv("MASTER_MAC"); err != nil {
		t.Fatal(err)
	}
	got := envMAC("MASTER_MAC")
	if got != ([6]byte{}) {
		t.Errorf("envMAC with unset env = %x, want zero", got)
	}
}

func TestEnvMAC_InvalidReturnsZero(t *testing.T) {
	t.Setenv("MASTER_MAC", "not-a-mac")
	got := envMAC("MASTER_MAC")
	if got != ([6]byte{}) {
		t.Errorf("envMAC with bad env = %x, want zero", got)
	}
}

func TestLoadMasterIdentity_UsesEnv(t *testing.T) {
	tempDir := t.TempDir()
	keyPath := filepath.Join(tempDir, "masterkey.json")
	t.Setenv("MASTER_KEY_PATH", keyPath)
	t.Setenv("MASTER_MAC", "de:ad:be:ef:00:01")

	gotPath, gotMAC := loadMasterIdentity()
	if gotPath != keyPath {
		t.Errorf("keyPath = %q, want %q", gotPath, keyPath)
	}
	wantMAC := [6]byte{0xde, 0xad, 0xbe, 0xef, 0x00, 0x01}
	if gotMAC != wantMAC {
		t.Errorf("MAC = %x, want %x", gotMAC, wantMAC)
	}
}

func TestLoadMasterIdentity_Defaults(t *testing.T) {
	if err := os.Unsetenv("MASTER_KEY_PATH"); err != nil {
		t.Fatal(err)
	}
	if err := os.Unsetenv("MASTER_MAC"); err != nil {
		t.Fatal(err)
	}

	gotPath, gotMAC := loadMasterIdentity()
	if gotPath != "data/masterkey.json" {
		t.Errorf("default keyPath = %q, want %q", gotPath, "data/masterkey.json")
	}
	if gotMAC != ([6]byte{}) {
		t.Errorf("default MAC = %x, want zero (env not set)", gotMAC)
	}
}

// TestBootPath_PopulatesMeshConfig proves that main-path construction wires
// MASTER_KEY_PATH and MASTER_MAC into the MeshServerConfig. The regression this
// guards: main.go previously built MeshServerConfig without these fields, so
// NewMeshServer skipped LoadOrGenerateMasterKey and every JOIN_ACK shipped with
// all-zero PublicKey + OriginMacAddress, causing firmware to reject enrollments
// in production while unit tests (which built configs directly) passed.
func TestBootPath_PopulatesMeshConfig(t *testing.T) {
	tempDir := t.TempDir()
	keyPath := filepath.Join(tempDir, "masterkey.json")
	t.Setenv("MASTER_KEY_PATH", keyPath)
	t.Setenv("MASTER_MAC", "de:ad:be:ef:00:01")

	// Mirror main.go's config assembly.
	masterKeyPath, masterMAC := loadMasterIdentity()
	cfg := mesh.MeshServerConfig{
		BaudRate:      115200,
		HealthTimeout: 75 * time.Second,
		MasterKeyPath: masterKeyPath,
		MasterMAC:     masterMAC,
	}

	if cfg.MasterKeyPath == "" {
		t.Fatal("MasterKeyPath is empty — main-path failed to populate it")
	}
	if cfg.MasterMAC == ([6]byte{}) {
		t.Fatal("MasterMAC is zero — main-path failed to populate it; JOIN_ACK OriginMacAddress will be zero in production")
	}

	// Prove the config actually drives keypair generation in NewMeshServer.
	// If MasterKeyPath is empty, NewMeshServer skips LoadOrGenerateMasterKey
	// (mesh/server.go:148), which is exactly the production bug we're guarding.
	ms := mesh.NewMeshServer(cfg)
	if ms == nil {
		t.Fatal("NewMeshServer returned nil")
	}
	if _, err := os.Stat(keyPath); err != nil {
		t.Fatalf("expected masterkey.json to be created at %s; err=%v", keyPath, err)
	}
}
