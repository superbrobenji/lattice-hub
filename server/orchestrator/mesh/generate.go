// Package mesh — proto codegen entrypoint.
//
// Regenerate mesh.pb.go from mesh.proto:
//
//	cd server/orchestrator
//	go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11
//	go generate ./mesh/...
//
// CI enforces this via .github/workflows/ci.yml (proto-sync job).

//go:generate protoc --go_out=. --go_opt=paths=source_relative mesh.proto

package mesh
