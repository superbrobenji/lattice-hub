package mesh

import (
	"encoding/json"
	"net/http"
	"testing"
	"time"
)

// Frame ages relative to the 75s health timeout used by newTestMeshServer.
const (
	freshFrameAge = 10 * time.Second
	staleFrameAge = 80 * time.Second
)

// newDualMasterTestServer returns a test server with a secondary port
// configured — the MeshServer-level equivalent of DUAL_MASTER_ENABLED=true
// plus SERIAL_PORT_SECONDARY (main.go only passes SerialPortSecondary when
// both are set).
func newDualMasterTestServer(t *testing.T) *MeshServer {
	t.Helper()
	ms := newTestMeshServer(t)
	ms.secondaryPort = "/dev/ttyUSB1"
	return ms
}

// setLastFrames stamps the primary and secondary last-frame times as "age"
// ago. A zero age leaves that timestamp untouched (zero time = never seen).
func setLastFrames(t *testing.T, ms *MeshServer, primaryAge, secondaryAge time.Duration) {
	t.Helper()
	ms.frameTimeMu.Lock()
	defer ms.frameTimeMu.Unlock()
	if primaryAge > 0 {
		ms.primaryLastFrameAt = time.Now().Add(-primaryAge)
	}
	if secondaryAge > 0 {
		ms.secondaryLastFrameAt = time.Now().Add(-secondaryAge)
	}
}

func lastFrameTimes(ms *MeshServer) (primary, secondary time.Time) {
	ms.frameTimeMu.Lock()
	defer ms.frameTimeMu.Unlock()
	return ms.primaryLastFrameAt, ms.secondaryLastFrameAt
}

func assertOnline(t *testing.T, ms *MeshServer, wantPrimary, wantSecondary, wantMaster bool) {
	t.Helper()
	if got := ms.IsPrimaryOnline(); got != wantPrimary {
		t.Errorf("IsPrimaryOnline() = %v, want %v", got, wantPrimary)
	}
	if got := ms.IsSecondaryOnline(); got != wantSecondary {
		t.Errorf("IsSecondaryOnline() = %v, want %v", got, wantSecondary)
	}
	if got := ms.IsMasterOnline(); got != wantMaster {
		t.Errorf("IsMasterOnline() = %v, want %v", got, wantMaster)
	}
}

// --- Single-master mode (no secondary port configured) ---

func TestMasterOnline_SingleMaster_NoFrames(t *testing.T) {
	ms := newTestMeshServer(t)
	assertOnline(t, ms, false, false, false)
}

func TestMasterOnline_SingleMaster_PrimaryRecent(t *testing.T) {
	ms := newTestMeshServer(t)
	setLastFrames(t, ms, freshFrameAge, 0)
	assertOnline(t, ms, true, false, true)
}

func TestMasterOnline_SingleMaster_PrimaryStale(t *testing.T) {
	ms := newTestMeshServer(t)
	setLastFrames(t, ms, staleFrameAge, 0)
	assertOnline(t, ms, false, false, false)
}

func TestMasterOnline_DualMasterDisabled_IgnoresSecondaryFrames(t *testing.T) {
	// Without a configured secondary, a recent secondary timestamp must not
	// make either secondaryOnline or masterOnline read true.
	ms := newTestMeshServer(t)
	setLastFrames(t, ms, staleFrameAge, freshFrameAge)
	assertOnline(t, ms, false, false, false)
}

// --- Dual-master mode ---

func TestMasterOnline_DualMaster_NoFrames(t *testing.T) {
	ms := newDualMasterTestServer(t)
	assertOnline(t, ms, false, false, false)
}

func TestMasterOnline_DualMaster_PrimaryOnly(t *testing.T) {
	ms := newDualMasterTestServer(t)
	setLastFrames(t, ms, freshFrameAge, staleFrameAge)
	assertOnline(t, ms, true, false, true)
}

func TestMasterOnline_DualMaster_SecondaryNeverSeen(t *testing.T) {
	// Secondary port configured but it never produced a frame (e.g. failed
	// to open): only the primary counts.
	ms := newDualMasterTestServer(t)
	setLastFrames(t, ms, freshFrameAge, 0)
	assertOnline(t, ms, true, false, true)
}

func TestMasterOnline_DualMaster_SecondaryOnly(t *testing.T) {
	// The #166 scenario: primary unplugged, secondary still reporting.
	ms := newDualMasterTestServer(t)
	setLastFrames(t, ms, staleFrameAge, freshFrameAge)
	assertOnline(t, ms, false, true, true)
}

func TestMasterOnline_DualMaster_Both(t *testing.T) {
	ms := newDualMasterTestServer(t)
	setLastFrames(t, ms, freshFrameAge, freshFrameAge)
	assertOnline(t, ms, true, true, true)
}

func TestMasterOnline_DualMaster_Neither(t *testing.T) {
	ms := newDualMasterTestServer(t)
	setLastFrames(t, ms, staleFrameAge, staleFrameAge)
	assertOnline(t, ms, false, false, false)
}

// --- Frame attribution: a frame counts for the link it arrived on ---

// frameBytes encodes msg exactly as the serial transport puts it on the wire.
func frameBytes(t *testing.T, msg *MeshMessage) []byte {
	t.Helper()
	scratch := NewMockSerialPort()
	if err := NewSerialComm(scratch).WriteFrame(msg); err != nil {
		t.Fatalf("encode frame: %v", err)
	}
	return scratch.GetWrittenData()
}

// runProcessorUntilFrame feeds one frame into a fresh mock port, runs
// messageProcessor on it under the given link label until lastFrameAt
// reports the frame was recorded, then stops the processor.
func runProcessorUntilFrame(t *testing.T, ms *MeshServer, label string, lastFrameAt func() time.Time) {
	t.Helper()
	mock := NewMockSerialPort()
	// ProtoVersion 1 is dropped by handleMessage, so only the link-liveness
	// accounting runs — no registry, event, or Kafka side effects.
	mock.AddReadData(frameBytes(t, &MeshMessage{ProtoVersion: 1, MessageType: MessageTypeMasterBeacon}))

	ms.wg.Add(1)
	go ms.messageProcessor(NewSerialComm(mock), label)
	defer func() {
		ms.cancel()
		ms.wg.Wait()
	}()

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if !lastFrameAt().IsZero() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("%s link: frame not recorded before deadline", label)
}

func TestMessageProcessor_SecondaryFrame_RecordsSecondaryLinkOnly(t *testing.T) {
	ms := newDualMasterTestServer(t)
	runProcessorUntilFrame(t, ms, "secondary", func() time.Time {
		_, secondary := lastFrameTimes(ms)
		return secondary
	})
	if primary, _ := lastFrameTimes(ms); !primary.IsZero() {
		t.Errorf("primaryLastFrameAt = %v, want zero — secondary frame must not be attributed to primary", primary)
	}
	assertOnline(t, ms, false, true, true)
}

func TestMessageProcessor_PrimaryFrame_RecordsPrimaryLinkOnly(t *testing.T) {
	ms := newDualMasterTestServer(t)
	runProcessorUntilFrame(t, ms, "primary", func() time.Time {
		primary, _ := lastFrameTimes(ms)
		return primary
	})
	if _, secondary := lastFrameTimes(ms); !secondary.IsZero() {
		t.Errorf("secondaryLastFrameAt = %v, want zero — primary frame must not be attributed to secondary", secondary)
	}
	assertOnline(t, ms, true, false, true)
}

// --- GET /api/v1/status mesh block ---

func meshStatusBlock(t *testing.T, api *APIServer) map[string]bool {
	t.Helper()
	w := v1Request(t, api, "GET", "/api/v1/status", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status returned %d", w.Code)
	}
	var resp APIResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	data, _ := json.Marshal(resp.Data)
	var body struct {
		Mesh map[string]bool `json:"mesh"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatalf("unmarshal status: %v", err)
	}
	return body.Mesh
}

func assertMeshStatus(t *testing.T, got map[string]bool, want map[string]bool) {
	t.Helper()
	for key, wantVal := range want {
		gotVal, ok := got[key]
		if !ok {
			t.Errorf("mesh.%s missing from status response (got %v)", key, got)
			continue
		}
		if gotVal != wantVal {
			t.Errorf("mesh.%s = %v, want %v", key, gotVal, wantVal)
		}
	}
}

func TestV1Status_Mesh_DualMaster_SecondaryOnlyKeepsMasterOnline(t *testing.T) {
	api, ms := newV1TestServer(t)
	ms.secondaryPort = "/dev/ttyUSB1"
	setLastFrames(t, ms, staleFrameAge, freshFrameAge)

	assertMeshStatus(t, meshStatusBlock(t, api), map[string]bool{
		"masterOnline":    true,
		"primaryOnline":   false,
		"secondaryOnline": true,
	})
}

func TestV1Status_Mesh_DualMaster_SecondaryDeadIsVisible(t *testing.T) {
	api, ms := newV1TestServer(t)
	ms.secondaryPort = "/dev/ttyUSB1"
	setLastFrames(t, ms, freshFrameAge, staleFrameAge)

	assertMeshStatus(t, meshStatusBlock(t, api), map[string]bool{
		"masterOnline":    true,
		"primaryOnline":   true,
		"secondaryOnline": false,
	})
}

func TestV1Status_Mesh_SingleMaster_SecondaryOnlinePresentAndFalse(t *testing.T) {
	api, ms := newV1TestServer(t)
	setLastFrames(t, ms, freshFrameAge, 0)

	assertMeshStatus(t, meshStatusBlock(t, api), map[string]bool{
		"masterOnline":    true,
		"primaryOnline":   true,
		"secondaryOnline": false,
	})
}
