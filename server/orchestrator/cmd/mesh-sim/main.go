// server/orchestrator/cmd/mesh-sim/main.go
package main

import (
	"context"
	"log/slog"
	"net"
	"net/http"
	"os"
	"time"

	"github.com/superbrobenji/lattice-hub/meshsim"
)

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func main() {
	serialAddr := envOr("SIM_SERIAL_ADDR", ":9000")
	controlAddr := envOr("SIM_CONTROL_ADDR", ":9001")
	nodesPath := os.Getenv("SIM_NODES_PATH")

	cfg, err := meshsim.LoadConfig(nodesPath)
	if err != nil {
		slog.Error("failed to load sim config", "path", nodesPath, "err", err)
		os.Exit(1)
	}
	sim := meshsim.New(cfg)

	ln, err := net.Listen("tcp", serialAddr)
	if err != nil {
		slog.Error("failed to listen", "addr", serialAddr, "err", err)
		os.Exit(1)
	}
	go sim.ServeSerial(ln)
	go sim.Run(context.Background())

	slog.Info("mesh-sim up", "serial", serialAddr, "control", controlAddr, "nodes", len(cfg.Nodes))
	srv := &http.Server{Addr: controlAddr, Handler: sim.ControlHandler(), ReadHeaderTimeout: 5 * time.Second}
	if err := srv.ListenAndServe(); err != nil {
		slog.Error("control server exited", "err", err)
		os.Exit(1)
	}
}
