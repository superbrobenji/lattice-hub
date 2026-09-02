package mesh

import (
	"encoding/json"
	"errors"
	"net/http"
	"testing"

	EventStore "github.com/superbrobenji/lattice-hub/eventStore"
)

func TestV1Status_SingleMaster_SerialBlockShowsPrimaryOnly(t *testing.T) {
	api, ms := newV1TestServer(t)
	mock := NewMockSerialPort()
	ms.serialComm = NewSerialComm(mock)
	// secondarySerialComm remains nil — single master mode

	w := v1Request(t, api, "GET", "/api/v1/status", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status returned %d", w.Code)
	}

	var resp APIResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	data, _ := json.Marshal(resp.Data)
	var status struct {
		Serial struct {
			Primary   string `json:"primary"`
			Secondary string `json:"secondary"`
		} `json:"serial"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		t.Fatalf("unmarshal status: %v", err)
	}
	if status.Serial.Primary != "connected" {
		t.Errorf("serial.primary = %q, want %q", status.Serial.Primary, "connected")
	}
	if status.Serial.Secondary != "not_configured" {
		t.Errorf("serial.secondary = %q, want %q", status.Serial.Secondary, "not_configured")
	}
}

func TestV1Status_DualMaster_SecondaryConnected(t *testing.T) {
	api, ms := newV1TestServer(t)
	primaryMock := NewMockSerialPort()
	secondaryMock := NewMockSerialPort()
	ms.serialComm = NewSerialComm(primaryMock)
	ms.secondarySerialComm = NewSerialComm(secondaryMock)
	ms.secondaryConnected = true

	w := v1Request(t, api, "GET", "/api/v1/status", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status returned %d", w.Code)
	}

	var resp APIResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	data, _ := json.Marshal(resp.Data)
	var status struct {
		Serial struct {
			Primary   string `json:"primary"`
			Secondary string `json:"secondary"`
		} `json:"serial"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		t.Fatalf("unmarshal status: %v", err)
	}
	if status.Serial.Primary != "connected" {
		t.Errorf("serial.primary = %q, want %q", status.Serial.Primary, "connected")
	}
	if status.Serial.Secondary != "connected" {
		t.Errorf("serial.secondary = %q, want %q", status.Serial.Secondary, "connected")
	}
}

func TestV1Status_DualMaster_SecondaryDisconnected(t *testing.T) {
	api, ms := newV1TestServer(t)
	primaryMock := NewMockSerialPort()
	ms.serialComm = NewSerialComm(primaryMock)
	// secondarySerialComm is nil but secondaryPort is set — secondary configured but failed to open
	ms.secondaryPort = "/dev/ttyUSB1"
	ms.secondaryConnected = false

	w := v1Request(t, api, "GET", "/api/v1/status", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status returned %d", w.Code)
	}

	var resp APIResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	data, _ := json.Marshal(resp.Data)
	var status struct {
		Serial struct {
			Primary   string `json:"primary"`
			Secondary string `json:"secondary"`
		} `json:"serial"`
	}
	if err := json.Unmarshal(data, &status); err != nil {
		t.Fatalf("unmarshal status: %v", err)
	}
	if status.Serial.Secondary != "disconnected" {
		t.Errorf("serial.secondary = %q, want %q", status.Serial.Secondary, "disconnected")
	}
}

func TestV1Status_NodesNextFreeId(t *testing.T) {
	api, ms := newV1TestServer(t)
	// Assign node ID 1
	ms.nodeRegistry.AssignNode([]byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}, 1, "n1", "z1")
	ms.nodeRegistry.UpdateNode([]byte{0x01, 0x02, 0x03, 0x04, 0x05, 0x06}, AdapterTypePIR, 100, 1)

	w := v1Request(t, api, "GET", "/api/v1/status", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var resp APIResponse
	if err := json.NewDecoder(w.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	data, _ := json.Marshal(resp.Data)
	var body struct {
		Nodes struct {
			NextFreeId int `json:"nextFreeId"`
		} `json:"nodes"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatalf("unmarshal body: %v", err)
	}
	if body.Nodes.NextFreeId != 2 {
		t.Errorf("nextFreeId = %d, want 2 (ID 1 is taken)", body.Nodes.NextFreeId)
	}
}

// kafkaStatusV1 mirrors the `kafka` object of GET /api/v1/status.
type kafkaStatusV1 struct {
	Connected   bool `json:"connected"`
	TopicsReady bool `json:"topicsReady"`
	Topics      map[string]struct {
		Ready         bool    `json:"ready"`
		FailedWrites  uint64  `json:"failedWrites"`
		LastError     string  `json:"lastError"`
		LastFailureAt *string `json:"lastFailureAt"`
	} `json:"topics"`
	FailedWrites  uint64  `json:"failedWrites"`
	LastError     string  `json:"lastError"`
	LastFailureAt *string `json:"lastFailureAt"`
}

func getKafkaStatus(t *testing.T, api *APIServer) kafkaStatusV1 {
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
		Kafka *kafkaStatusV1 `json:"kafka"`
	}
	if err := json.Unmarshal(data, &body); err != nil {
		t.Fatalf("unmarshal status: %v", err)
	}
	if body.Kafka == nil {
		t.Fatalf("status has no kafka object: %s", data)
	}
	return *body.Kafka
}

func TestV1Status_Kafka_ReportsEventStoreFailures(t *testing.T) {
	api, ms := newV1TestServer(t)
	mock := ms.eventStore.(*MockEventStore)
	mock.WriteErr = errors.New("kafka down")
	_ = mock.WriteMessage("x", EventStore.TopicMeshMessages)
	_ = mock.WriteMessage("x", EventStore.TopicMeshMessages)

	k := getKafkaStatus(t, api)

	if !k.Connected {
		t.Error("kafka.connected = false, want true while an event store is configured")
	}
	if k.FailedWrites != 2 {
		t.Errorf("kafka.failedWrites = %d, want 2", k.FailedWrites)
	}
	if k.LastError != "kafka down" {
		t.Errorf("kafka.lastError = %q, want %q", k.LastError, "kafka down")
	}
	if k.LastFailureAt == nil {
		t.Error("kafka.lastFailureAt = null, want timestamp")
	}
	if got := k.Topics[EventStore.TopicMeshMessages].FailedWrites; got != 2 {
		t.Errorf("kafka.topics[mesh-messages].failedWrites = %d, want 2", got)
	}
	if got := k.Topics[EventStore.TopicMotionTrigger].FailedWrites; got != 0 {
		t.Errorf("kafka.topics[motion-trigger].failedWrites = %d, want 0", got)
	}
}

func TestV1Status_Kafka_WithoutEventStore(t *testing.T) {
	api, ms := newV1TestServer(t)
	ms.eventStore = nil

	k := getKafkaStatus(t, api)

	if k.Connected {
		t.Error("kafka.connected = true without an event store")
	}
	if k.TopicsReady {
		t.Error("kafka.topicsReady = true without an event store")
	}
	if k.FailedWrites != 0 || k.LastError != "" || k.LastFailureAt != nil {
		t.Errorf("unexpected failure state without an event store: %+v", k)
	}
	for _, name := range EventStore.Topics() {
		ts, ok := k.Topics[name]
		if !ok {
			t.Errorf("kafka.topics is missing %s", name)
			continue
		}
		if ts.Ready {
			t.Errorf("kafka.topics[%s].ready = true without an event store", name)
		}
	}
}
