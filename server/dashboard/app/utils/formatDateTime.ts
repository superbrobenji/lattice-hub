export function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
}

export function fromUnix(ts: number): string {
  return new Date(ts * 1000).toLocaleString([], { dateStyle: "short", timeStyle: "medium" });
}

export function nodeStatus(lastSeen: string): "ok" | "warn" | "error" {
  const ms = Date.now() - new Date(lastSeen).getTime();
  if (ms < 60_000) return "ok";
  if (ms < 300_000) return "warn";
  return "error";
}
