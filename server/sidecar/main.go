package main

import (
	"log"
	"net/http"
	"os"

	"github.com/gorilla/mux"
	"github.com/superbrobenji/lattice-hub/sidecar/handlers"
)

func main() {
	adminKey := os.Getenv("ADMIN_KEY")
	if adminKey == "" {
		log.Fatal("ADMIN_KEY is required")
	}
	kafkaBroker := envOrDefault("KAFKA_BROKER", "kafka:9092")
	project := envOrDefault("COMPOSE_PROJECT", "server")

	containerHandler, err := handlers.NewContainerHandler(project)
	if err != nil {
		log.Fatalf("Docker client init failed: %v", err)
	}
	kafkaHandler := handlers.NewKafkaHandler(kafkaBroker)

	r := mux.NewRouter()
	r.Use(handlers.AuthMiddleware(adminKey))

	r.HandleFunc("/sidecar/containers", containerHandler.ListContainers).Methods("GET")
	r.HandleFunc("/sidecar/containers/{name}/restart", containerHandler.RestartContainer).Methods("POST")
	r.HandleFunc("/sidecar/containers/{name}/logs", containerHandler.GetLogs).Methods("GET")
	r.HandleFunc("/sidecar/containers/{name}/stats", containerHandler.GetStats).Methods("GET")
	r.HandleFunc("/sidecar/containers/{name}/inspect", containerHandler.InspectContainer).Methods("GET")
	r.HandleFunc("/sidecar/kafka/status", kafkaHandler.Status).Methods("GET")
	r.HandleFunc("/sidecar/kafka/events/recent", kafkaHandler.RecentEvents).Methods("GET")
	healthHandler := handlers.NewHealthHandler(containerHandler.DockerClient(), kafkaBroker, project)
	r.HandleFunc("/sidecar/services/health", healthHandler.Services).Methods("GET")

	log.Printf("Sidecar listening on :9000")
	if err := http.ListenAndServe(":9000", corsMiddleware(r)); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
