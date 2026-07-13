import { useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/_auth.infrastructure.$name";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { Badge, containerStateBadge } from "~/components/ui/Badge";
import { StatBar } from "~/components/ui/StatBar";
import { LogViewer } from "~/components/features/LogViewer";
import { useContainerStats } from "~/hooks/useContainerStats";

type Tab = "overview" | "stats" | "logs";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "stats", label: "Stats" },
  { id: "logs", label: "Logs" },
];

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const tail = parseInt(url.searchParams.get("tail") ?? "100", 10) || 100;
  const [inspect, stats, logs] = await Promise.allSettled([
    sidecar.inspectContainer(params.name),
    sidecar.getStats(params.name),
    sidecar.getLogs(params.name, tail),
  ]);
  return {
    name: params.name,
    inspect: inspect.status === "fulfilled" ? inspect.value : null,
    initialStats: stats.status === "fulfilled" ? stats.value : null,
    initialLogs: logs.status === "fulfilled" ? logs.value : "",
  };
}

export default function ContainerDetail({ loaderData }: Route.ComponentProps) {
  const { name, inspect, initialStats, initialLogs } = loaderData;
  const [tab, setTab] = useState<Tab>("overview");
  const { stats } = useContainerStats(name, tab === "stats");

  const activeStats = stats ?? initialStats;

  return (
    <div>
      <nav className="text-xs text-muted mb-4">
        <Link to="/infrastructure" className="hover:text-accent">
          Infrastructure
        </Link>
        <span className="mx-2">/</span>
        <span className="text-text">{name}</span>
      </nav>

      <PageHeader
        title={name}
        actions={
          inspect ? (
            <Badge
              label={inspect.dockerState}
              variant={containerStateBadge(inspect.dockerState)}
            />
          ) : null
        }
      />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === "overview" && !inspect && (
        <p className="text-sm text-muted">Container details unavailable</p>
      )}
      {tab === "overview" && inspect && (
        <div className="space-y-6">
          {/* Metadata */}
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {[
              { label: "Image", value: inspect.image },
              { label: "Created", value: new Date(inspect.created).toLocaleString() },
              { label: "Restart policy", value: inspect.restartPolicy || "—" },
              { label: "Health", value: inspect.dockerHealth },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted">{label}</span>
                <span className="text-sm text-text font-mono">{value}</span>
              </div>
            ))}
          </div>

          {/* Ports */}
          {Object.keys(inspect.ports).length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Ports
              </h3>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {Object.entries(inspect.ports).map(([containerPort, bindings]) =>
                  (bindings ?? []).map((b, i) => (
                    <div
                      key={`${containerPort}-${i}`}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <span className="font-mono text-muted">{containerPort}</span>
                      <span className="font-mono text-text">
                        {b.hostIP}:{b.hostPort}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Mounts */}
          {inspect.mounts.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Mounts
              </h3>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border">
                {inspect.mounts.map((m) => (
                  <div key={m.destination} className="px-4 py-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-mono text-muted truncate">{m.source}</span>
                      <span className="text-muted mx-2">→</span>
                      <span className="font-mono text-text truncate">{m.destination}</span>
                      <Badge label={m.rw ? "rw" : "ro"} variant={m.rw ? "warn" : "muted"} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Env vars */}
          {inspect.envVars.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Environment
              </h3>
              <div className="bg-surface border border-border rounded-lg divide-y divide-border max-h-64 overflow-y-auto">
                {inspect.envVars.map((e) => (
                  <div
                    key={e.key}
                    className="flex items-baseline justify-between px-4 py-2 text-xs"
                  >
                    <span className="font-mono text-muted">{e.key}</span>
                    <span
                      className={`font-mono truncate max-w-[60%] ${
                        e.value === "[redacted]" ? "text-warn" : "text-text"
                      }`}
                    >
                      {e.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stats tab */}
      {tab === "stats" && (
        <div className="space-y-4 max-w-sm">
          {activeStats ? (
            <>
              <StatBar
                value={activeStats.cpuPercent}
                max={100}
                label="CPU"
                unit="%"
                formatValue={(v) => v.toFixed(1)}
              />
              <StatBar
                value={activeStats.memUsedBytes / 1024 / 1024}
                max={activeStats.memLimitBytes / 1024 / 1024}
                label="Memory"
                unit=" MB"
                formatValue={(v) => v.toFixed(0)}
              />
            </>
          ) : (
            <p className="text-muted text-sm">Stats unavailable</p>
          )}
        </div>
      )}

      {/* Logs tab */}
      {tab === "logs" && (
        <LogViewer initialLogs={initialLogs} containerName={name} />
      )}
    </div>
  );
}
