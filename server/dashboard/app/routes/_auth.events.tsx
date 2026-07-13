import { useState } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/_auth.events";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { usePolling } from "~/hooks/usePolling";
import { fromUnix } from "~/utils/formatDateTime";
import type { KafkaEvent } from "~/types/kafka";

const N_OPTIONS = [50, 100, 250] as const;
type NOption = (typeof N_OPTIONS)[number];

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const n = Math.min(parseInt(url.searchParams.get("n") ?? "50", 10), 250) as NOption;
  const response = await sidecar.getRecentEvents(n);
  return { events: response.events ?? [], topic: response.topic, n };
}

export default function Events({ loaderData }: Route.ComponentProps) {
  const { events, topic, n } = loaderData;
  const [, setSearchParams] = useSearchParams();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const { data: polled } = usePolling<typeof loaderData>(`/events?n=${n}`, 10_000);
  const activeEvents: KafkaEvent[] = polled?.events ?? events;

  const toggleExpand = (offset: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(offset) ? next.delete(offset) : next.add(offset);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Events"
        description={`Topic: ${topic ?? "—"}`}
        actions={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Last</span>
            {N_OPTIONS.map((opt) => (
              <button
                key={opt}
                onClick={() => setSearchParams({ n: String(opt) })}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  opt === n
                    ? "bg-accent text-white"
                    : "bg-elevated text-muted hover:text-text"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        }
      />

      <div className="space-y-1">
        {activeEvents.length === 0 ? (
          <p className="text-muted text-sm">No events</p>
        ) : (
          activeEvents.map((event) => {
            const isExpanded = expanded.has(event.offset);
            return (
              <div
                key={event.offset}
                className="bg-surface border border-border rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleExpand(event.offset)}
                  className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-elevated transition-colors"
                >
                  <span className="font-mono text-xs text-muted w-16 shrink-0">
                    #{event.offset}
                  </span>
                  <span className="text-xs text-muted shrink-0">
                    {fromUnix(event.timestamp)}
                  </span>
                  <span className="font-mono text-sm text-text truncate">
                    {event.value}
                  </span>
                  <span className="text-muted ml-auto shrink-0">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-3 border-t border-border">
                    <pre className="text-xs font-mono text-text mt-2 whitespace-pre-wrap break-all">
                      {event.value}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
