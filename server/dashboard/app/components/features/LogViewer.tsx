import { useEffect, useRef, useState } from "react";

interface LogViewerProps {
  initialLogs: string;
  containerName: string;
}

const TAIL_OPTIONS = [100, 500, 1000] as const;
type TailOption = (typeof TAIL_OPTIONS)[number];

export function LogViewer({ initialLogs, containerName }: LogViewerProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [tail, setTail] = useState<TailOption>(100);
  const [loading, setLoading] = useState(false);
  const [liveStream, setLiveStream] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const fetchLogs = async (t: TailOption) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/logs/${containerName}?tail=${t}`);
      if (res.ok) setLogs(await res.text());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!liveStream) return;
    const id = setInterval(() => fetchLogs(tail), 3000);
    return () => clearInterval(id);
  }, [liveStream, tail, containerName]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleTailChange = (t: TailOption) => {
    setTail(t);
    fetchLogs(t);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted">Tail:</span>
          {TAIL_OPTIONS.map((t) => (
            <button
              key={t}
              onClick={() => handleTailChange(t)}
              className={`px-2 py-1 text-xs rounded ${
                tail === t
                  ? "bg-accent text-white"
                  : "bg-elevated text-muted hover:text-text"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs(tail)}
            disabled={loading}
            className="text-xs text-accent hover:underline disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={liveStream}
              onChange={(e) => setLiveStream(e.target.checked)}
              className="accent-accent"
            />
            Live
          </label>
        </div>
      </div>

      <div className="bg-base border border-border rounded-lg overflow-auto max-h-[500px] p-4">
        <pre className="text-xs font-mono text-text whitespace-pre-wrap break-all leading-relaxed">
          {logs || "No logs available"}
        </pre>
        <div ref={endRef} />
      </div>
    </div>
  );
}
