import type { SSEEvent } from "../services/sse";

export function EventFeed({ events }: { events: SSEEvent[] }) {
  return (
    <div className="event-feed">
      {events.slice(0, 50).map((e, i) => (
        <div key={i} className={`event event-${e.type}`}>
          <span className="event-type">{e.type}</span>
          <pre>{JSON.stringify(e, null, 2)}</pre>
        </div>
      ))}
      {events.length === 0 && <p>Waiting for events...</p>}
    </div>
  );
}
