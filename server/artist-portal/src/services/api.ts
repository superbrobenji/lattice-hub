const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

export interface Node {
  id: number;
  name: string;
  zone: string;
  online: boolean;
  adapterType: string;
  uptime: number;
  hopCount: number;
  lastSeen: string;
}

export interface SystemStatus {
  serial: { primary: string; secondary: string };
  nodes: { total: number; online: number; offline: number };
  mesh: { masterOnline: boolean };
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options);
  const body = await res.json();
  if (!body.success) throw new Error(body.error ?? "API error");
  return body.data as T;
}

export const api = {
  getStatus: (): Promise<SystemStatus> => apiFetch("/api/v1/status").then((d: any) => d as SystemStatus),
  getNodes: (): Promise<Node[]> => apiFetch<Node[]>("/api/v1/nodes"),
  sendNodeCommand: (id: number, action: string, colour?: number[]) =>
    apiFetch(`/api/v1/nodes/${id}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, colour }),
    }),
};
