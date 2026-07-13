import { useFetcher } from "react-router";
import type { Route } from "./+types/_auth.server";
import { requireAuth } from "~/services/auth.server";
import { orchestrator } from "~/services/orchestrator.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { StatusDot } from "~/components/ui/StatusDot";
import type { ServerStatus } from "~/types/nodes";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const status = await orchestrator.getStatus();
  return { status };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  if (intent === "start") await orchestrator.startServer();
  if (intent === "stop") await orchestrator.stopServer();
  const status = await orchestrator.getStatus();
  return { status };
}

export default function ServerPage({ loaderData }: Route.ComponentProps) {
  const fetcher = useFetcher<{ status: ServerStatus }>();
  const status = fetcher.data?.status ?? loaderData.status;
  const busy = fetcher.state !== "idle";

  return (
    <div>
      <PageHeader
        title="Server"
        description="Mesh server process controls — distinct from container management"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status card */}
        <div className="bg-surface border border-border rounded-lg divide-y divide-border">
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Master online</span>
            <div className="flex items-center gap-2">
              <StatusDot variant={status.mesh.masterOnline ? "ok" : "error"} />
              <span className="text-sm text-text">
                {status.mesh.masterOnline ? "Online" : "Offline"}
              </span>
            </div>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Serial primary</span>
            <span className="text-sm font-mono text-text">{status.serial.primary}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Serial secondary</span>
            <span className="text-sm font-mono text-text">{status.serial.secondary}</span>
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-muted">Nodes (total / online / offline)</span>
            <span className="text-sm text-text">
              {status.nodes.total} / {status.nodes.online} / {status.nodes.offline}
            </span>
          </div>
        </div>

        {/* Controls card */}
        <div className="bg-surface border border-border rounded-lg p-4 space-y-3">
          <p className="text-sm font-medium text-text">Process controls</p>
          <p className="text-xs text-muted">
            Start/stop the mesh server process. Use Infrastructure to restart the
            container.
          </p>
          <fetcher.Form method="post" className="flex gap-3">
            <button
              name="intent"
              value="start"
              disabled={busy}
              className="flex-1 py-2 text-sm rounded-lg bg-accent hover:bg-accent-hover text-white transition-colors disabled:opacity-50"
            >
              Start
            </button>
            <button
              name="intent"
              value="stop"
              disabled={busy}
              className="flex-1 py-2 text-sm rounded-lg bg-danger/20 text-danger hover:bg-danger/30 transition-colors disabled:opacity-50"
            >
              Stop
            </button>
          </fetcher.Form>
          {busy && <p className="text-xs text-muted animate-pulse">Processing…</p>}
        </div>
      </div>
    </div>
  );
}
