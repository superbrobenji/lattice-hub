export const DASHBOARD_URL = 'http://localhost:3000';
export const PORTAL_URL = 'http://localhost:3001';
export const ORCH_URL = 'http://localhost:8080';
export const SIM_URL = 'http://localhost:9001';

// Seed mesh (server/stub-data/sim-nodes.json + nodes.json).
// MACs identify sim nodes via the mesh-sim control API (helpers/sim.ts).
export const ENTRANCE_MAC = 'aa:bb:cc:dd:ee:01'; // pir, online
export const HALLWAY_MAC = 'aa:bb:cc:dd:ee:02'; // led, online, routes via entrance
export const KITCHEN_MAC = 'aa:bb:cc:dd:ee:03'; // pir, silent → offline
export const LOUNGE_MAC = 'aa:bb:cc:dd:ee:04'; // relay, online

// The orchestrator's public API (GET /api/v1/nodes) does not expose MAC address
// on registered nodes (only pending enrollments carry a mac field) — verified
// live during Task 7. Use these NAME constants for orchestrator-side lookups
// (OrchClient#nodeByName); use the MAC constants above for sim-side lookups.
export const ENTRANCE_NAME = 'Entrance-PIR';
export const HALLWAY_NAME = 'Hallway-LED';
export const KITCHEN_NAME = 'Kitchen-PIR';
export const LOUNGE_NAME = 'Lounge-Relay';
