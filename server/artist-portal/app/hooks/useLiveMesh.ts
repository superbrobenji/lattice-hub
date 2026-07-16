import { useEffect, useState, useCallback } from "react";
import { useFetcher } from "react-router";
import type { Node, SSEEvent } from "../types/nodes";
import { connectSSE } from "../services/sse";

const REFRESH_EVENTS: SSEEvent["type"][] = ["health", "node_online", "node_offline", "route_update"];

export function useLiveMesh(initialNodes: Node[], initialOnline: boolean) {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [events, setEvents] = useState<SSEEvent[]>([]);
  const [serverOnline, setServerOnline] = useState<boolean | null>(initialOnline);
  const fetcher = useFetcher<{ nodes: Node[] }>();

  useEffect(() => {
    if (fetcher.data?.nodes) {
      setNodes(fetcher.data.nodes);
    }
  }, [fetcher.data]);

  const refreshNodes = useCallback(() => {
    fetcher.load("/nodes-refresh");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- fetcher ref is stable

  useEffect(() => {
    const disconnect = connectSSE(
      (event) => {
        setServerOnline(true);
        setEvents((prev) => [event, ...prev].slice(0, 200));
        if (REFRESH_EVENTS.includes(event.type)) {
          refreshNodes();
        }
      },
      () => setServerOnline(false),
    );
    return disconnect;
  }, [refreshNodes]);

  return { nodes, events, serverOnline, refreshNodes };
}
