import type { SSEEvent } from "../../types/nodes";

const typeColors: Record<string, string> = {
  motion: "text-warn",
  health: "text-ok",
  node_online: "text-ok",
  node_offline: "text-danger",
  enrolled: "text-accent",
  command_ack: "text-muted",
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function EventRow({ event }: { event: SSEEvent }) {
  const color = typeColors[event.type] ?? "text-muted";
  const ts = "timestamp" in event ? event.timestamp : new Date().toISOString();

  return (
    <div className="flex items-start gap-3 py-2 border-b border-border/50 text-xs last:border-0">
      <span className="text-muted shrink-0 font-mono">{formatTime(ts)}</span>
      <span className={`shrink-0 font-medium ${color}`}>{event.type}</span>
      {"name" in event && (
        <span className="text-muted truncate">{event.name as string}</span>
      )}
    </div>
  );
}

export function EventFeed({ events }: { events: SSEEvent[] }) {
  if (!events.length) {
    return (
      <p className="text-sm text-muted py-4">Waiting for events…</p>
    );
  }
  return (
    <div className="bg-surface border border-border rounded-lg px-4 divide-y divide-border/50 max-h-80 overflow-y-auto">
      {events.slice(0, 50).map((e, i) => (
        <EventRow key={i} event={e} />
      ))}
    </div>
  );
}
