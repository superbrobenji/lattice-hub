package mesh

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
)

func (api *APIServer) v1GetPendingEnrollments(w http.ResponseWriter, r *http.Request) {
	pending := api.meshServer.GetPendingEnrollments()
	api.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: pending})
}

func (api *APIServer) v1GetAllEnrollments(w http.ResponseWriter, r *http.Request) {
	all := api.meshServer.GetAuthRegistry().GetAll()
	api.writeJSON(w, http.StatusOK, APIResponse{Success: true, Data: all})
}

func (api *APIServer) v1ApproveEnrollment(w http.ResponseWriter, r *http.Request) {
	mac := mux.Vars(r)["mac"]
	var body struct {
		Name   string `json:"name"`
		Zone   string `json:"zone"`
		Type   string `json:"type"`
		NodeID uint8  `json:"nodeId"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&body) // body optional
	}
	params := ApprovalParams{
		NodeID:         body.NodeID,
		Name:           body.Name,
		Zone:           body.Zone,
		AdapterTypeStr: body.Type,
	}
	if err := api.meshServer.ApproveEnrollment(mac, params); err != nil {
		api.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if body.Type != "" {
		if adapterType, ok := adapterTypeFromString(body.Type); ok {
			// ApproveEnrollment has already assigned the node; look it up by MAC string
			// nodeauth.Registry has no Get(mac) method — filter GetAll() instead
			registry := api.meshServer.GetAuthRegistry()
			for _, n := range registry.GetAll() {
				if n.MACString == mac {
					_ = api.meshServer.ConfigureNode(n.MAC[:], adapterType)
					break
				}
			}
		}
	}
	api.writeJSON(w, http.StatusOK, APIResponse{Success: true, Message: "enrollment approved"})
}

func (api *APIServer) v1RejectEnrollment(w http.ResponseWriter, r *http.Request) {
	mac := mux.Vars(r)["mac"]
	if err := api.meshServer.RejectEnrollment(mac); err != nil {
		api.writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	api.writeJSON(w, http.StatusOK, APIResponse{Success: true, Message: "enrollment rejected"})
}
