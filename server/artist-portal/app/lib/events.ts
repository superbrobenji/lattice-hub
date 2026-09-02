import type { SSEEvent } from "../types/nodes";

/** Formats an uptime in seconds as a compact, human-readable duration. */
export function formatUptime(seconds: number): string {
  if (!Number.isFinite(seconds)) return "—";
  const total = Math.max(0, Math.floor(seconds));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/**
 * Type-specific detail for an event feed row. The row already shows the
 * timestamp, the event type and (when present) the node name, so this returns
 * only what each variant adds on top of that.
 *
 * Exhaustive over SSEEvent: adding a variant without a case here is a type
 * error, so a new event type fails typecheck instead of rendering blank.
 */
export function eventDetail(event: SSEEvent): string {
  switch (event.type) {
    case "motion":
      return `zone ${event.zone || "—"}`;
    case "health":
      return `${event.online ? "online" : "offline"} · up ${formatUptime(event.uptime)}`;
    case "node_online":
    case "node_offline":
      return "";
    case "enrolled":
      return `type ${event.adapterType}`;
    case "command_ack":
      return `node ${event.nodeId} · ${event.status} · cmd ${event.commandId}`;
    case "route_update":
      return `node ${event.nodeId} → ${event.parentId == null ? "master" : `parent ${event.parentId}`}`;
    default: {
      const unhandled: never = event;
      throw new Error(`Unhandled SSE event: ${JSON.stringify(unhandled)}`);
    }
  }
}
