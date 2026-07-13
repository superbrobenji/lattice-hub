import type { INode, IZone, IEnrollment, ServerStatus } from "~/types/nodes";

const BASE_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8080";
const API_KEY = process.env.API_KEY ?? "";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) throw new Error(`orchestrator ${path} → ${res.status}`);
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? "request failed");
  return body.data as T;
}

export const orchestrator = {
  getNodes: () => apiFetch<INode[]>("/api/v1/nodes"),
  getNode: (id: number) => apiFetch<INode>(`/api/v1/nodes/${id}`),
  updateNode: (id: number, patch: Partial<{ name: string; zone: string; type: string }>) =>
    apiFetch<INode>(`/api/v1/nodes/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
  getZones: () => apiFetch<IZone[]>("/api/v1/zones"),
  getPendingEnrollments: () => apiFetch<IEnrollment[]>("/api/v1/enrollments/pending"),
  approveEnrollment: (mac: string, params: { name?: string; zone?: string; type?: string }) =>
    apiFetch(`/api/v1/enrollments/${mac}/approve`, {
      method: "POST",
      body: JSON.stringify(params),
    }),
  rejectEnrollment: (mac: string) =>
    apiFetch(`/api/v1/enrollments/${mac}/reject`, { method: "POST" }),
  getStatus: () => apiFetch<ServerStatus>("/api/v1/status"),
  startServer: async () => {
    const res = await fetch(`${BASE_URL}/server/start`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`start failed: ${res.status}`);
  },
  stopServer: async () => {
    const res = await fetch(`${BASE_URL}/server/stop`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    if (!res.ok) throw new Error(`stop failed: ${res.status}`);
  },
};
