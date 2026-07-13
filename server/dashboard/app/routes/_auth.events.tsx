import { Suspense, useState } from "react";
import { Await, useSearchParams } from "react-router";
import type { Route } from "./+types/_auth.events";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { fromUnix } from "~/utils/formatDateTime";
import type { KafkaEvent } from "~/types/kafka";

const N_OPTIONS = [50, 100, 250] as const;
type NOption = (typeof N_OPTIONS)[number];

type EventsPayload = {
  events: KafkaEvent[];
  topic: string | null;
  error: string | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const n = Math.min(parseInt(url.searchParams.get("n") ?? "50", 10), 250) as NOption;

  // Not awaited — streams to client so page shell renders immediately
  const eventsData: Promise<EventsPayload> = sidecar
    .getRecentEvents(n)
    .then((r) => ({ events: (r.events ?? []) as KafkaEvent[], topic: r.topic ?? null, error: null }))
    .catch(() => ({ events: [] as KafkaEvent[], topic: null, error: "Kafka unavailable" }));

  return { eventsData, n };
}

function EventsSkeleton() {
  return (
    <div className="space-y-1 animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-12 bg-surface border border-border rounded-lg" />
      ))}
    </div>
  );
}

function EventsList({ events, error }: { events: KafkaEvent[]; error: string | null }) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggle = (offset: number) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(offset)) next.delete(offset);
      else next.add(offset);
      return next;
    });

  if (error) return <p className="text-danger text-sm">{error}</p>;
  if (events.length === 0) return <p className="text-muted text-sm">No events</p>;

  return (
    <>
      {events.map((event) => {
        const isExpanded = expanded.has(event.offset);
        return (
          <div
            key={event.offset}
            className="bg-surface border border-border rounded-lg overflow-hidden"
          >
            <button
              onClick={() => toggle(event.offset)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-elevated transition-colors"
            >
              <span className="font-mono text-xs text-muted w-16 shrink-0">
                #{event.offset}
              </span>
              <span className="text-xs text-muted shrink-0">
                {fromUnix(event.timestamp)}
              </span>
              <span className="font-mono text-sm text-text truncate">{event.value}</span>
              <span className="text-muted ml-auto shrink-0">{isExpanded ? "▲" : "▼"}</span>
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
      })}
    </>
  );
}

export default function Events({ loaderData }: Route.ComponentProps) {
  const { eventsData, n } = loaderData;
  const [, setSearchParams] = useSearchParams();

  return (
    <div>
      <PageHeader
        title="Events"
        description="Kafka topic: motion-trigger"
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
        <Suspense fallback={<EventsSkeleton />}>
          <Await resolve={eventsData}>
            {(payload: EventsPayload) => (
              <EventsList events={payload.events} error={payload.error} />
            )}
          </Await>
        </Suspense>
      </div>
    </div>
  );
}
