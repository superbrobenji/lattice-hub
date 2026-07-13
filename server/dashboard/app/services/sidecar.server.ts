import type { ContainerInfo, ContainerStats, ContainerInspect } from "~/types/containers";
import type { HealthReport } from "~/types/health";
import type { KafkaStatus, KafkaEventsResponse } from "~/types/kafka";

const BASE_URL = process.env.SIDECAR_URL ?? "http://localhost:9000";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

async function sidecarFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ADMIN_KEY}`,
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) throw new Error(`sidecar ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export const sidecar = {
  getContainers: () =>
    sidecarFetch<{ containers: ContainerInfo[] }>("/sidecar/containers").then(
      (r) => r.containers
    ),
  restartContainer: (name: string) =>
    sidecarFetch(`/sidecar/containers/${name}/restart`, { method: "POST" }),
  getStats: (name: string) =>
    sidecarFetch<ContainerStats>(`/sidecar/containers/${name}/stats`),
  inspectContainer: (name: string) =>
    sidecarFetch<ContainerInspect>(`/sidecar/containers/${name}/inspect`),
  getLogs: async (name: string, tail = 100): Promise<string> => {
    const res = await fetch(
      `${BASE_URL}/sidecar/containers/${name}/logs?tail=${tail}`,
      { headers: { Authorization: `Bearer ${ADMIN_KEY}` } }
    );
    if (!res.ok) throw new Error(`logs → ${res.status}`);
    return res.text();
  },
  getKafkaStatus: () => sidecarFetch<KafkaStatus>("/sidecar/kafka/status"),
  getRecentEvents: (n = 50) =>
    sidecarFetch<KafkaEventsResponse>(`/sidecar/kafka/events/recent?n=${n}`),
  getServicesHealth: () =>
    sidecarFetch<HealthReport>("/sidecar/services/health"),
};
