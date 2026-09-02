import type { SSEEvent } from "../types/nodes";

const SSE_NAMES: SSEEvent["type"][] = [
  "motion", "health", "node_online", "node_offline", "enrolled", "command_ack",
  "route_update",
];

/**
 * Builds a client SSEEvent from one SSE frame. The SSE event name is the
 * discriminant and is applied last so the payload can never overwrite it:
 * the orchestrator's `enrolled` payload carries the adapter type under `type`
 * (`{nodeId, name, type}`, see openapi/v1.yaml `/api/v1/events`), which is
 * lifted into `adapterType` here. The orchestrator stamps every event with an
 * RFC 3339 `timestamp`; when an older server omits it, the receive time is
 * recorded once here so rows keep a stable time across re-renders.
 */
export function parseSSEEvent(name: SSEEvent["type"], raw: string): SSEEvent {
  const payload = JSON.parse(raw) as Record<string, unknown>;
  const timestamp =
    typeof payload.timestamp === "string" ? payload.timestamp : new Date().toISOString();
  if (name === "enrolled") {
    const { type: wireType, ...rest } = payload;
    const adapterType = typeof wireType === "string" ? wireType : "unknown";
    return { adapterType, ...rest, timestamp, type: name } as SSEEvent;
  }
  return { ...payload, timestamp, type: name } as SSEEvent;
}

export function connectSSE(
  onEvent: (event: SSEEvent) => void,
  onDisconnect: () => void,
): () => void {
  const base = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:8080";
  const es = new EventSource(`${base}/api/v1/events`);

  SSE_NAMES.forEach((name) => {
    es.addEventListener(name, (e: MessageEvent) => {
      try {
        onEvent(parseSSEEvent(name, e.data));
      } catch (err) {
        console.error('[SSE] event parse error', name, err);
      }
    });
  });

  es.onerror = () => {
    onDisconnect();
    es.close();
  };

  return () => es.close();
}
