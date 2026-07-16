import type { SSEEvent } from "../types/nodes";

const SSE_NAMES: SSEEvent["type"][] = [
  "motion", "health", "node_online", "node_offline", "enrolled", "command_ack",
  "route_update",
];

export function connectSSE(
  onEvent: (event: SSEEvent) => void,
  onDisconnect: () => void,
): () => void {
  const base = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:8080";
  const es = new EventSource(`${base}/api/v1/events`);

  SSE_NAMES.forEach((name) => {
    es.addEventListener(name, (e: MessageEvent) => {
      try {
        onEvent({ type: name, ...JSON.parse(e.data) } as SSEEvent);
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
