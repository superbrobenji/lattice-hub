package meshsim

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/gorilla/mux"
)

// adapterTypeName maps the internal adapter type constant to the string
// vocabulary used by the control API and NodeConfig ("pir"/"led"/"relay"),
// plus "serial" and "unknown" for types the API doesn't spawn but may
// observe on seeded nodes.
func adapterTypeName(t int32) string {
	switch t {
	case 1:
		return "serial"
	case 2:
		return "pir"
	case 3:
		return "led"
	case 4:
		return "relay"
	default:
		return "unknown"
	}
}

// controlNode is the JSON shape for a single node in GET /sim/state.
type controlNode struct {
	MAC      string `json:"mac"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Enrolled bool   `json:"enrolled"`
	Rejected bool   `json:"rejected"`
	Offline  bool   `json:"offline"`
	Silent   bool   `json:"silent"`
	NodeID   uint8  `json:"nodeId"`
	AckCount int    `json:"ackCount"`
}

// spawnRequest is the JSON body for POST /sim/nodes.
type spawnRequest struct {
	MAC  string `json:"mac"`
	Type string `json:"type"`
}

// writeJSONError writes a {"error":"..."} body with the given status.
func writeJSONError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(map[string]string{"error": msg}); err != nil {
		slog.Error("meshsim control: failed to encode error response", "err", err)
	}
}

// ControlHandler returns an http.Handler exposing the deterministic test
// control API used to drive the simulator from e2e tests: inspect state,
// spawn nodes, fire motion events, and flip nodes online/offline.
func (s *Simulator) ControlHandler() http.Handler {
	r := mux.NewRouter()
	r.HandleFunc("/sim/state", s.handleState).Methods(http.MethodGet)
	r.HandleFunc("/sim/reset", s.handleReset).Methods(http.MethodPost)
	r.HandleFunc("/sim/nodes", s.handleSpawn).Methods(http.MethodPost)
	r.HandleFunc("/sim/nodes/{mac}/motion", s.handleMotion).Methods(http.MethodPost)
	r.HandleFunc("/sim/nodes/{mac}/offline", s.handleSetOffline(true)).Methods(http.MethodPost)
	r.HandleFunc("/sim/nodes/{mac}/online", s.handleSetOffline(false)).Methods(http.MethodPost)
	return r
}

func (s *Simulator) handleState(w http.ResponseWriter, r *http.Request) {
	snap := s.snapshot()
	out := make([]controlNode, 0, len(snap))
	for _, n := range snap {
		out = append(out, controlNode{
			MAC:      n.MACString,
			Name:     n.Name,
			Type:     adapterTypeName(n.AdapterType),
			Enrolled: n.Enrolled,
			Rejected: n.Rejected,
			Offline:  n.Offline,
			Silent:   n.Silent,
			NodeID:   n.NodeID,
			AckCount: n.AckCount,
		})
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(map[string]any{"nodes": out}); err != nil {
		slog.Error("meshsim control: failed to encode state response", "err", err)
	}
}

func (s *Simulator) handleReset(w http.ResponseWriter, r *http.Request) {
	s.Reset()
	w.WriteHeader(http.StatusNoContent)
}

func (s *Simulator) handleSpawn(w http.ResponseWriter, r *http.Request) {
	var req spawnRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSONError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	if err := s.SpawnNode(req.MAC, req.Type); err != nil {
		if errors.Is(err, errDuplicate) {
			writeJSONError(w, http.StatusConflict, err.Error())
			return
		}
		writeJSONError(w, http.StatusBadRequest, err.Error())
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (s *Simulator) handleMotion(w http.ResponseWriter, r *http.Request) {
	mac := mux.Vars(r)["mac"]
	if err := s.FireMotion(mac); err != nil {
		if errors.Is(err, errUnknownNode) {
			writeJSONError(w, http.StatusNotFound, err.Error())
			return
		}
		writeJSONError(w, http.StatusConflict, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleSetOffline returns a handler bound to the given offline state,
// shared by the /offline and /online routes.
func (s *Simulator) handleSetOffline(offline bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		mac := mux.Vars(r)["mac"]
		if err := s.SetOffline(mac, offline); err != nil {
			if errors.Is(err, errUnknownNode) {
				writeJSONError(w, http.StatusNotFound, err.Error())
				return
			}
			writeJSONError(w, http.StatusConflict, err.Error())
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
