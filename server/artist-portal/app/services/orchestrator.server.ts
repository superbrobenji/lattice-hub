import type { Node, SystemStatus } from "../types/nodes";

const BASE_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8080";
const API_KEY = process.env.API_KEY ?? "";

async function serverFetch<T>(path: string): Promise<T> {
  const headers: HeadersInit = API_KEY
    ? { Authorization: `Bearer ${API_KEY}` }
    : {};
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  const body = (await res.json()) as { success: boolean; data: T; error?: string };
  if (!body.success) throw new Error(body.error ?? "API error");
  return body.data;
}

export function getNodes(): Promise<Node[]> {
  return serverFetch<Node[]>("/api/v1/nodes");
}

export function getStatus(): Promise<SystemStatus> {
  return serverFetch<SystemStatus>("/api/v1/status");
}
