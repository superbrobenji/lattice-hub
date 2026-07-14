package meshsim

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestLoadConfig(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sim-nodes.json")
	content := `{"nodes":[{"mac":"aa:bb:cc:dd:ee:01","name":"Entrance-PIR","type":"pir","routePath":[],"heartbeatMs":3000},{"mac":"aa:bb:cc:dd:ee:03","name":"Kitchen-PIR","type":"pir","routePath":["aa:bb:cc:dd:ee:02","aa:bb:cc:dd:ee:01"],"heartbeatMs":3000,"silent":true}],"routeReportMs":6000}`
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	cfg, err := LoadConfig(path)
	if err != nil {
		t.Fatalf("LoadConfig: %v", err)
	}
	if len(cfg.Nodes) != 2 || cfg.RouteReportMs != 6000 {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	if !cfg.Nodes[1].Silent || len(cfg.Nodes[1].RoutePath) != 2 {
		t.Fatalf("kitchen node parsed wrong: %+v", cfg.Nodes[1])
	}
}

func TestLoadConfigEmptyPath(t *testing.T) {
	cfg, err := LoadConfig("")
	if err != nil || len(cfg.Nodes) != 0 {
		t.Fatalf("want empty config, got %+v, %v", cfg, err)
	}
}

func TestNewSeededNode(t *testing.T) {
	n, err := NewSeededNode(NodeConfig{MAC: "aa:bb:cc:dd:ee:02", Name: "Hallway-LED", Type: "led", RoutePath: []string{"aa:bb:cc:dd:ee:01"}, HeartbeatMs: 3000})
	if err != nil {
		t.Fatal(err)
	}
	if !n.Enrolled || n.AdapterType != 3 || n.HeartbeatInterval != 3*time.Second {
		t.Fatalf("bad node: %+v", n)
	}
	if n.MAC != [6]byte{0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0x02} || len(n.RoutePath) != 1 {
		t.Fatalf("bad mac/route: %+v", n)
	}
	if n.PublicKey == ([32]byte{}) {
		t.Fatal("public key must not be zero (zero key = rejection signal)")
	}
}

func TestParseMACErrors(t *testing.T) {
	if _, err := ParseMAC("nope"); err == nil {
		t.Fatal("want error")
	}
	if _, err := AdapterTypeFromString("toaster"); err == nil {
		t.Fatal("want error")
	}
	if _, err := ParseMAC("aa:bb:cc:dd:eee:01"); err == nil {
		t.Fatal("want error for 3-char segment")
	}
	if _, err := ParseMAC("a:bb:cc:dd:ee:01"); err == nil {
		t.Fatal("want error for 1-char segment")
	}
}
