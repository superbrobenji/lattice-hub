package mesh

import (
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/curve25519"
)

func TestLoadOrGenerateMasterKey_CreateNew(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "master.key")

	// Generate new key
	kp, err := LoadOrGenerateMasterKey(keyPath)
	if err != nil {
		t.Fatalf("failed to generate new key: %v", err)
	}

	if kp == nil {
		t.Fatal("expected non-nil keypair")
	}

	// Verify public key is derived from private key
	var expectedPub [32]byte
	curve25519.ScalarBaseMult(&expectedPub, &kp.PrivateKey)
	if expectedPub != kp.PublicKey {
		t.Error("public key does not match private key")
	}

	// Verify clamping
	if kp.PrivateKey[0]&7 != 0 {
		t.Error("private key not properly clamped (lowest 3 bits should be 0)")
	}
	if kp.PrivateKey[31]&128 != 0 {
		t.Error("private key not properly clamped (bit 255 should be 0)")
	}
	if kp.PrivateKey[31]&64 == 0 {
		t.Error("private key not properly clamped (bit 254 should be 1)")
	}

	// Verify file exists with correct permissions
	info, err := os.Stat(keyPath)
	if err != nil {
		t.Fatalf("key file not created: %v", err)
	}
	if info.Mode().Perm() != 0600 {
		t.Errorf("expected file permissions 0600, got %o", info.Mode().Perm())
	}
}

func TestLoadOrGenerateMasterKey_LoadExisting(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "master.key")

	// Generate new key
	kp1, err := LoadOrGenerateMasterKey(keyPath)
	if err != nil {
		t.Fatalf("failed to generate new key: %v", err)
	}

	// Load existing key
	kp2, err := LoadOrGenerateMasterKey(keyPath)
	if err != nil {
		t.Fatalf("failed to load existing key: %v", err)
	}

	// Verify they are the same
	if kp1.PrivateKey != kp2.PrivateKey {
		t.Error("private keys do not match")
	}
	if kp1.PublicKey != kp2.PublicKey {
		t.Error("public keys do not match")
	}
}

func TestLoadOrGenerateMasterKey_CorruptedFile(t *testing.T) {
	tmpDir := t.TempDir()
	keyPath := filepath.Join(tmpDir, "master.key")

	// Write invalid JSON
	if err := os.WriteFile(keyPath, []byte("not valid json"), 0600); err != nil {
		t.Fatalf("failed to write corrupted file: %v", err)
	}

	// Should return error, not regenerate
	_, err := LoadOrGenerateMasterKey(keyPath)
	if err == nil {
		t.Fatal("expected error for corrupted file")
	}

	// Verify file still exists (not overwritten)
	data, err := os.ReadFile(keyPath)
	if err != nil {
		t.Fatalf("file was deleted: %v", err)
	}
	if string(data) != "not valid json" {
		t.Error("file was overwritten")
	}

	// Test with valid JSON but mismatched keys
	tmpDir2 := t.TempDir()
	keyPath2 := filepath.Join(tmpDir2, "master.key")

	badJSON := `{"private_key":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"public_key":[1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]}`
	if err := os.WriteFile(keyPath2, []byte(badJSON), 0600); err != nil {
		t.Fatalf("failed to write mismatched key file: %v", err)
	}

	_, err = LoadOrGenerateMasterKey(keyPath2)
	if err == nil {
		t.Fatal("expected error for mismatched public/private key")
	}
}
