import type { Node, SystemStatus, Zone, Enrollment } from "../types/nodes";

const BASE_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8080";
const API_KEY = process.env.API_KEY ?? "";
// Admin-tier operations (enrollment decisions, deletes) send ADMIN_KEY, which
// may differ from API_KEY. Falls back to API_KEY for setups where they match.
const ADMIN_KEY = process.env.ADMIN_KEY ?? API_KEY;

async function serverFetch<T>(path: string): Promise<T> {
  const headers: HeadersInit = API_KEY
    ? { Authorization: `Bearer ${API_KEY}` }
    : {};
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = (await res.json()) as { success: boolean; data: T; error?: string };
  if (!body.success) throw new Error(body.error ?? "API error");
  return body.data;
}

async function serverMutate<T = undefined>(
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: unknown,
  admin = false,
): Promise<T> {
  const key = admin ? ADMIN_KEY : API_KEY;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as { success: boolean; data?: T; error?: string };
  if (!json.success) throw new Error(json.error ?? "API error");
  return json.data as T;
}

// Commands (node/zone LED+relay) are ack-tracked, not fire-and-forget: the
// orchestrator returns 202 with a body callers/tests need to correlate
// against (commandId for nodes, sent count for zones), so unlike
// serverMutate above this returns the orchestrator's response body
// unmodified rather than unwrapping/discarding it.
async function serverCommand<T>(path: string, body: unknown): Promise<T> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
  return json;
}

export function getNodes(): Promise<Node[]> {
  return serverFetch<Node[]>("/api/v1/nodes");
}

export function getStatus(): Promise<SystemStatus> {
  return serverFetch<SystemStatus>("/api/v1/status");
}

export function updateNode(
  id: number,
  patch: { name?: string; zone?: string; type?: string },
): Promise<Node> {
  return serverMutate<Node>(`/api/v1/nodes/${id}`, "PATCH", patch);
}

export function deleteNode(id: number): Promise<void> {
  return serverMutate<void>(`/api/v1/nodes/${id}`, "DELETE", undefined, true);
}

export function getZones(): Promise<Zone[]> {
  return serverFetch<Zone[]>("/api/v1/zones");
}

export function createZone(name: string): Promise<Zone> {
  return serverMutate<Zone>("/api/v1/zones", "POST", { name });
}

export function updateZone(id: string, name: string): Promise<Zone> {
  return serverMutate<Zone>(`/api/v1/zones/${id}`, "PATCH", { name });
}

export function deleteZone(id: string): Promise<void> {
  return serverMutate<void>(`/api/v1/zones/${id}`, "DELETE", undefined, true);
}

export function getPendingEnrollments(): Promise<Enrollment[]> {
  return serverFetch<Enrollment[]>("/api/v1/enrollments/pending");
}

export function getAllEnrollments(): Promise<Enrollment[]> {
  return serverFetch<Enrollment[]>("/api/v1/enrollments");
}

export function approveEnrollment(
  mac: string,
  params: { name?: string; zone?: string; type?: string; nodeId?: number },
): Promise<void> {
  return serverMutate<void>(
    `/api/v1/enrollments/${encodeURIComponent(mac)}/approve`,
    "POST",
    params,
    true,
  );
}

export function rejectEnrollment(mac: string): Promise<void> {
  return serverMutate<void>(
    `/api/v1/enrollments/${encodeURIComponent(mac)}/reject`,
    "POST",
    undefined,
    true,
  );
}

export function sendNodeCommand(
  id: number,
  body: { action: string; colour?: number[] },
): Promise<{ success: boolean; data?: { commandId: string }; error?: string }> {
  return serverCommand(`/api/v1/nodes/${id}/command`, body);
}

export function sendZoneCommand(
  id: string,
  body: { action: string; colour?: number[] },
): Promise<{ success: boolean; data?: { sent: number }; error?: string }> {
  return serverCommand(`/api/v1/zones/${id}/command`, body);
}
