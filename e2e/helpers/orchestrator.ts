import { ORCH_URL } from './urls';

// Verified live during Task 6/7 smoke testing: X-API-Key works for GET-only
// "public" routes (/api/v1/nodes, /api/v1/status), but /api/v1/enrollments/pending
// and command endpoints require Authorization: Bearer. Send both on every request.
const HEADERS = {
  'X-API-Key': 'dev',
  Authorization: 'Bearer dev',
  'Content-Type': 'application/json',
};

/**
 * Node shape as returned by GET /api/v1/nodes and /api/v1/nodes/:id
 * (server/orchestrator/mesh/api_v1_types.go NodeV1). Verified against the live
 * stack — note this does NOT include a `mac` field; the orchestrator's public
 * API never surfaces MAC on registered nodes, only on pending enrollments
 * (see OrchEnrollment below). Use `name` to correlate with sim-side MACs.
 */
export interface OrchNode {
  id: number;
  name: string;
  zone: string;
  type: string;
  online: boolean;
  hopCount: number;
  uptime: number;
  lastSeen: string;
  parentId?: number;
}

/** GET /api/v1/enrollments/pending entry shape (mesh.enrollmentResponse). */
export interface OrchEnrollment {
  mac: string;
  publicKey: string;
  status: number;
  receivedAt: number;
  approvedAt: number;
}

/** GET /api/v1/nodes/:id/command/:commandId response shape. */
export interface OrchCommandStatus {
  commandId: string;
  nodeId: number;
  action: string;
  status: string;
  sentAt: number;
  ackedAt?: number;
}

/** GET /api/v1/status response shape (mesh.v1Status). */
export interface OrchStatus {
  mesh: { masterOnline: boolean };
  nodes: { total: number; online: number; offline: number; nextFreeId: number };
  serial: { primary: string; secondary: string };
}

interface APIEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export class OrchClient {
  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${ORCH_URL}${path}`, { headers: HEADERS });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
    const body = (await res.json()) as APIEnvelope<T>;
    return body.data as T;
  }
  nodes(): Promise<OrchNode[]> {
    return this.get('/api/v1/nodes');
  }
  async nodeByName(name: string): Promise<OrchNode | undefined> {
    return (await this.nodes()).find((n) => n.name === name);
  }
  pending(): Promise<OrchEnrollment[]> {
    return this.get('/api/v1/enrollments/pending');
  }
  commandStatus(nodeId: number, commandId: string): Promise<OrchCommandStatus> {
    return this.get(`/api/v1/nodes/${nodeId}/command/${commandId}`);
  }
  status(): Promise<OrchStatus> {
    return this.get('/api/v1/status');
  }
}
