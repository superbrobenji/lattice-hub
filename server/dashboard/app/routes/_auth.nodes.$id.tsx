import { Link } from "react-router";
import type { Route } from "./+types/_auth.nodes.$id";
import { requireAuth } from "~/services/auth.server";
import { orchestrator } from "~/services/orchestrator.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { StatusDot } from "~/components/ui/StatusDot";
import { Badge } from "~/components/ui/Badge";
import { nodeStatus, formatDateTime, fromUnix } from "~/utils/formatDateTime";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const node = await orchestrator.getNode(Number(params.id));
  return { node };
}

export default function NodeDetail({ loaderData }: Route.ComponentProps) {
  const { node } = loaderData;
  const status = nodeStatus(node.lastSeen);

  return (
    <div>
      <nav className="text-xs text-muted mb-4">
        <Link to="/nodes" className="hover:text-accent">Nodes</Link>
        <span className="mx-2">/</span>
        <span className="text-text">{node.name}</span>
      </nav>

      <PageHeader
        title={node.name}
        actions={<StatusDot variant={status} />}
      />

      <div className="bg-surface border border-border rounded-lg divide-y divide-border">
        {[
          { label: "ID", value: String(node.id) },
          { label: "Zone", value: <Badge label={node.zone || "—"} variant="muted" /> },
          { label: "Type", value: <Badge label={node.adapterType} variant="accent" /> },
          { label: "Online", value: node.online ? "Yes" : "No" },
          { label: "Uptime", value: `${node.uptime}s` },
          { label: "Hops", value: String(node.hopCount) },
          { label: "Last seen", value: formatDateTime(node.lastSeen) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">{label}</span>
            <span className="text-sm text-text">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
