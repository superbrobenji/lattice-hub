package mesh

import (
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"golang.org/x/crypto/curve25519"
)

// MasterKeypair represents the hub's master Curve25519 keypair.
type MasterKeypair struct {
	PrivateKey [32]byte `json:"private_key"`
	PublicKey  [32]byte `json:"public_key"`
}

// LoadOrGenerateMasterKey loads an existing master keypair from the given path,
// or generates a new one if the file does not exist.
// Returns an error if the file exists but is corrupted.
func LoadOrGenerateMasterKey(path string) (*MasterKeypair, error) {
	// Try to load existing key
	data, err := os.ReadFile(path)
	if err == nil {
		// File exists, try to parse it
		var kp MasterKeypair
		if err := json.Unmarshal(data, &kp); err != nil {
			return nil, fmt.Errorf("corrupted master key file: %w", err)
		}
		// Validate that the public key matches the private key
		var expectedPub [32]byte
		curve25519.ScalarBaseMult(&expectedPub, &kp.PrivateKey)
		if expectedPub != kp.PublicKey {
			return nil, errors.New("corrupted master key file: public key does not match private key")
		}
		return &kp, nil
	}

	// If file doesn't exist, generate new keypair
	if !os.IsNotExist(err) {
		return nil, fmt.Errorf("failed to read master key file: %w", err)
	}

	// Generate new keypair
	var priv [32]byte
	if _, err := rand.Read(priv[:]); err != nil {
		return nil, fmt.Errorf("failed to generate random key: %w", err)
	}

	// Apply Curve25519 clamping
	priv[0] &= 248
	priv[31] &= 127
	priv[31] |= 64

	// Derive public key
	var pub [32]byte
	curve25519.ScalarBaseMult(&pub, &priv)

	kp := &MasterKeypair{
		PrivateKey: priv,
		PublicKey:  pub,
	}

	// Persist to file with restricted permissions
	j, err := json.Marshal(kp)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal keypair: %w", err)
	}

	if err := os.WriteFile(path, j, 0600); err != nil {
		return nil, fmt.Errorf("failed to write master key file: %w", err)
	}

	return kp, nil
}
