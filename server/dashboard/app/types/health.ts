export type HealthStatus = "ok" | "warn" | "error" | "unknown";

export interface ServiceHealth {
  name: string;
  dockerState: string;
  dockerHealth: string;
  httpStatus?: number;
  latencyMs?: number;
  detail: Record<string, unknown>;
  checkedAt: string;
}

export interface HealthReport {
  services: ServiceHealth[];
}

export function deriveStatus(svc: ServiceHealth): HealthStatus {
  if (svc.dockerState !== "running") return "error";
  if (svc.dockerHealth === "unhealthy") return "error";
  if (svc.dockerHealth === "starting") return "warn";
  if (svc.httpStatus !== undefined && svc.httpStatus >= 500) return "error";
  if (svc.httpStatus !== undefined && svc.httpStatus >= 400) return "warn";
  if (svc.dockerState === "running") return "ok";
  return "unknown";
}
