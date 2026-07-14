package meshsim

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestControlStateAndSpawn(t *testing.T) {
	sim, _ := newTestSim(t, seededCfg())
	srv := httptest.NewServer(sim.ControlHandler())
	defer srv.Close()

	res, err := srv.Client().Post(srv.URL+"/sim/nodes", "application/json", strings.NewReader(`{"mac":"aa:bb:cc:dd:ee:99","type":"led"}`))
	if err != nil || res.StatusCode != 201 {
		t.Fatalf("spawn: %v %d", err, res.StatusCode)
	}
	res, _ = srv.Client().Post(srv.URL+"/sim/nodes", "application/json", strings.NewReader(`{"mac":"aa:bb:cc:dd:ee:99","type":"led"}`))
	if res.StatusCode != 409 {
		t.Fatalf("duplicate spawn: %d", res.StatusCode)
	}

	res, err = srv.Client().Get(srv.URL + "/sim/state")
	if err != nil || res.StatusCode != 200 {
		t.Fatalf("state: %v", err)
	}
	var state struct {
		Nodes []struct {
			MAC      string `json:"mac"`
			Type     string `json:"type"`
			Enrolled bool   `json:"enrolled"`
		} `json:"nodes"`
	}
	if err := json.NewDecoder(res.Body).Decode(&state); err != nil {
		t.Fatal(err)
	}
	if len(state.Nodes) != 3 {
		t.Fatalf("want 3 nodes, got %d", len(state.Nodes))
	}
}

func TestControlOfflineOnlineMotionReset(t *testing.T) {
	sim, orch := newTestSim(t, seededCfg())
	srv := httptest.NewServer(sim.ControlHandler())
	defer srv.Close()
	post := func(path string) int {
		res, err := srv.Client().Post(srv.URL+path, "application/json", nil)
		if err != nil {
			t.Fatal(err)
		}
		return res.StatusCode
	}
	if got := post("/sim/nodes/aa:bb:cc:dd:ee:01/offline"); got != 204 {
		t.Fatalf("offline: %d", got)
	}
	if got := post("/sim/nodes/aa:bb:cc:dd:ee:01/motion"); got != 409 {
		t.Fatalf("motion while offline: %d", got)
	}
	if got := post("/sim/nodes/aa:bb:cc:dd:ee:01/online"); got != 204 {
		t.Fatalf("online: %d", got)
	}
	done := make(chan struct{})
	go func() { orch.ReadFrame(); close(done) }() //nolint:errcheck
	if got := post("/sim/nodes/aa:bb:cc:dd:ee:01/motion"); got != 204 {
		t.Fatalf("motion: %d", got)
	}
	<-done
	if got := post("/sim/nodes/no:pe/motion"); got != 404 {
		t.Fatalf("unknown mac: %d", got)
	}
	if got := post("/sim/reset"); got != 204 {
		t.Fatalf("reset: %d", got)
	}
}

func TestControlErrorPaths(t *testing.T) {
	// Test 1-5: spawn/offline/online error paths with httptest server
	sim, _ := newTestSim(t, seededCfg())
	srv := httptest.NewServer(sim.ControlHandler())
	defer srv.Close()

	// Test 1: malformed JSON → 400
	res, err := srv.Client().Post(srv.URL+"/sim/nodes", "application/json", strings.NewReader(`{oops`))
	if err != nil || res.StatusCode != 400 {
		t.Fatalf("malformed JSON: %v %d", err, res.StatusCode)
	}

	// Test 2: bad MAC format → 400
	res, err = srv.Client().Post(srv.URL+"/sim/nodes", "application/json", strings.NewReader(`{"mac":"nope","type":"led"}`))
	if err != nil || res.StatusCode != 400 {
		t.Fatalf("bad MAC: %v %d", err, res.StatusCode)
	}

	// Test 3: bad type → 400
	res, err = srv.Client().Post(srv.URL+"/sim/nodes", "application/json", strings.NewReader(`{"mac":"aa:bb:cc:dd:ee:97","type":"toaster"}`))
	if err != nil || res.StatusCode != 400 {
		t.Fatalf("bad type: %v %d", err, res.StatusCode)
	}

	// Test 4: offline on non-existent node → 404
	res, err = srv.Client().Post(srv.URL+"/sim/nodes/ff:ff:ff:ff:ff:00/offline", "application/json", nil)
	if err != nil || res.StatusCode != 404 {
		t.Fatalf("offline nonexistent: %v %d", err, res.StatusCode)
	}

	// Test 5: online on non-existent node → 404
	res, err = srv.Client().Post(srv.URL+"/sim/nodes/ff:ff:ff:ff:ff:00/online", "application/json", nil)
	if err != nil || res.StatusCode != 404 {
		t.Fatalf("online nonexistent: %v %d", err, res.StatusCode)
	}

	// Test 6: motion on unenrolled spawned node → 409
	res, err = srv.Client().Post(srv.URL+"/sim/nodes", "application/json", strings.NewReader(`{"mac":"aa:bb:cc:dd:ee:94","type":"led"}`))
	if err != nil || res.StatusCode != 201 {
		t.Fatalf("spawn unenrolled: %v %d", err, res.StatusCode)
	}
	res, err = srv.Client().Post(srv.URL+"/sim/nodes/aa:bb:cc:dd:ee:94/motion", "application/json", nil)
	if err != nil || res.StatusCode != 409 {
		t.Fatalf("motion on unenrolled: %v %d", err, res.StatusCode)
	}

	// Test 7: motion with disconnected orchestrator → 409
	simNoComm := New(seededCfg())
	srvNoComm := httptest.NewServer(simNoComm.ControlHandler())
	defer srvNoComm.Close()
	res, err = srvNoComm.Client().Post(srvNoComm.URL+"/sim/nodes/aa:bb:cc:dd:ee:01/motion", "application/json", nil)
	if err != nil || res.StatusCode != 409 {
		t.Fatalf("motion disconnected: %v %d", err, res.StatusCode)
	}
}
