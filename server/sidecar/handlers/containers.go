package handlers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/docker/docker/errdefs"
	"github.com/gorilla/mux"
)

type ContainerHandler struct {
	docker  *client.Client
	project string
}

func NewContainerHandler(project string) (*ContainerHandler, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}
	return &ContainerHandler{docker: cli, project: project}, nil
}

func (h *ContainerHandler) DockerClient() *client.Client {
	return h.docker
}

func (h *ContainerHandler) ListContainers(w http.ResponseWriter, r *http.Request) {
	f := filters.NewArgs()
	f.Add("label", "com.docker.compose.project="+h.project)
	containers, err := h.docker.ContainerList(context.Background(), container.ListOptions{All: true, Filters: f})
	if err != nil {
		http.Error(w, `{"error":"docker unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	type containerInfo struct {
		ID     string   `json:"id"`
		Names  []string `json:"names"`
		Image  string   `json:"image"`
		Status string   `json:"status"`
		State  string   `json:"state"`
	}
	out := make([]containerInfo, 0, len(containers))
	for _, c := range containers {
		id := c.ID
		if len(id) > 12 {
			id = id[:12]
		}
		out = append(out, containerInfo{ID: id, Names: c.Names, Image: c.Image, Status: c.Status, State: c.State})
	}
	WriteJSON(w, http.StatusOK, map[string]interface{}{"containers": out})
}

func (h *ContainerHandler) RestartContainer(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	timeout := 10
	if err := h.docker.ContainerRestart(context.Background(), name, container.StopOptions{Timeout: &timeout}); err != nil {
		http.Error(w, `{"error":"restart failed"}`, http.StatusInternalServerError)
		return
	}
	WriteJSON(w, http.StatusOK, map[string]string{"status": "restarting", "container": name})
}

func (h *ContainerHandler) GetLogs(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	tail := r.URL.Query().Get("tail")
	if tail == "" {
		tail = "100"
	}
	if n, err := strconv.Atoi(tail); err != nil || n < 1 || n > 1000 {
		tail = "100"
	}
	logs, err := h.docker.ContainerLogs(context.Background(), name, container.LogsOptions{
		ShowStdout: true, ShowStderr: true, Tail: tail,
	})
	if err != nil {
		http.Error(w, `{"error":"logs unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	defer func() { _ = logs.Close() }()
	w.Header().Set("Content-Type", "text/plain")
	_, _ = io.Copy(w, logs)
}

type dockerStatsJSON struct {
	CPUStats struct {
		CPUUsage struct {
			TotalUsage  uint64   `json:"total_usage"`
			PercpuUsage []uint64 `json:"percpu_usage"`
		} `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
		OnlineCPUs  uint32 `json:"online_cpus"`
	} `json:"cpu_stats"`
	PreCPUStats struct {
		CPUUsage    struct{ TotalUsage uint64 `json:"total_usage"` } `json:"cpu_usage"`
		SystemUsage uint64 `json:"system_cpu_usage"`
	} `json:"precpu_stats"`
	MemoryStats struct {
		Usage uint64            `json:"usage"`
		Limit uint64            `json:"limit"`
		Stats map[string]uint64 `json:"stats"`
	} `json:"memory_stats"`
}

func (h *ContainerHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	resp, err := h.docker.ContainerStats(ctx, name, false)
	if err != nil {
		http.Error(w, `{"error":"stats unavailable"}`, http.StatusServiceUnavailable)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	var s dockerStatsJSON
	if err := json.NewDecoder(resp.Body).Decode(&s); err != nil {
		http.Error(w, `{"error":"failed to decode stats"}`, http.StatusInternalServerError)
		return
	}

	cpuDeltaRaw := int64(s.CPUStats.CPUUsage.TotalUsage) - int64(s.PreCPUStats.CPUUsage.TotalUsage)
	sysDeltaRaw := int64(s.CPUStats.SystemUsage) - int64(s.PreCPUStats.SystemUsage)
	if cpuDeltaRaw < 0 { cpuDeltaRaw = 0 }
	if sysDeltaRaw < 0 { sysDeltaRaw = 0 }
	cpuDelta := float64(cpuDeltaRaw)
	sysDelta := float64(sysDeltaRaw)
	numCPUs := float64(s.CPUStats.OnlineCPUs)
	if numCPUs == 0 {
		numCPUs = float64(len(s.CPUStats.CPUUsage.PercpuUsage))
	}
	var cpuPercent float64
	if sysDelta > 0 && numCPUs > 0 {
		cpuPercent = (cpuDelta / sysDelta) * numCPUs * 100.0
	}

	cache := s.MemoryStats.Stats["cache"]
	memUsed := s.MemoryStats.Usage
	if memUsed > cache {
		memUsed -= cache
	}

	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"cpuPercent":    cpuPercent,
		"memUsedBytes":  memUsed,
		"memLimitBytes": s.MemoryStats.Limit,
	})
}

var sensitiveKeyFragments = []string{"KEY", "SECRET", "TOKEN", "PASSWORD", "PASS", "PWD"}

// IsSecretEnvKey reports whether the given environment variable key looks like
// a secret (contains a sensitive keyword fragment).
func IsSecretEnvKey(key string) bool {
	upper := strings.ToUpper(key)
	for _, s := range sensitiveKeyFragments {
		if strings.Contains(upper, s) {
			return true
		}
	}
	return false
}

type portBinding struct {
	HostIP   string `json:"hostIP"`
	HostPort string `json:"hostPort"`
}

type envVar struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type mountPoint struct {
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Mode        string `json:"mode"`
	RW          bool   `json:"rw"`
}

func (h *ContainerHandler) InspectContainer(w http.ResponseWriter, r *http.Request) {
	name := mux.Vars(r)["name"]
	info, err := h.docker.ContainerInspect(context.Background(), name)
	if err != nil {
		if errdefs.IsNotFound(err) {
			http.Error(w, `{"error":"container not found"}`, http.StatusNotFound)
		} else {
			http.Error(w, `{"error":"docker unavailable"}`, http.StatusServiceUnavailable)
		}
		return
	}

	// Ports
	ports := map[string][]portBinding{}
	for p, bindings := range info.NetworkSettings.Ports {
		var bs []portBinding
		for _, b := range bindings {
			bs = append(bs, portBinding{HostIP: b.HostIP, HostPort: b.HostPort})
		}
		ports[string(p)] = bs
	}

	// Mounts
	var mounts []mountPoint
	for _, m := range info.Mounts {
		mounts = append(mounts, mountPoint{Source: m.Source, Destination: m.Destination, Mode: m.Mode, RW: m.RW})
	}

	// Env vars with redaction
	var envVars []envVar
	for _, e := range info.Config.Env {
		parts := strings.SplitN(e, "=", 2)
		key := parts[0]
		val := ""
		if len(parts) == 2 {
			val = parts[1]
		}
		if IsSecretEnvKey(key) {
			val = "[redacted]"
		}
		envVars = append(envVars, envVar{Key: key, Value: val})
	}

	dockerHealth := "none"
	if info.State.Health != nil {
		dockerHealth = info.State.Health.Status
	}

	restartPolicy := ""
	if info.HostConfig != nil {
		restartPolicy = string(info.HostConfig.RestartPolicy.Name)
	}

	WriteJSON(w, http.StatusOK, map[string]interface{}{
		"id":            func() string { if len(info.ID) > 12 { return info.ID[:12] }; return info.ID }(),
		"name":          strings.TrimPrefix(info.Name, "/"),
		"image":         info.Config.Image,
		"created":       info.Created,
		"dockerState":   info.State.Status,
		"dockerHealth":  dockerHealth,
		"restartPolicy": restartPolicy,
		"ports":         ports,
		"mounts":        mounts,
		"envVars":       envVars,
	})
}
