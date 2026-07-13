import { Link } from "react-router";
import { StatusDot } from "~/components/ui/StatusDot";
import { Badge } from "~/components/ui/Badge";
import type { INode } from "~/types/nodes";
import { nodeStatus, formatDateTime } from "~/utils/formatDateTime";

interface NodeCardProps {
  node: INode;
}

export function NodeCard({ node }: NodeCardProps) {
  const status = nodeStatus(node.lastSeen);
  return (
    <Link
      to={`/nodes/${node.id}`}
      className="block bg-surface border border-border rounded-lg p-4 hover:bg-elevated transition-colors"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-medium text-text">{node.name}</span>
        <StatusDot variant={status} />
      </div>
      <div className="space-y-1.5 text-xs text-muted">
        <div className="flex justify-between">
          <span>ID</span>
          <span className="font-mono text-text">{node.id}</span>
        </div>
        <div className="flex justify-between">
          <span>Zone</span>
          <Badge label={node.zone || "—"} variant="muted" />
        </div>
        <div className="flex justify-between">
          <span>Type</span>
          <Badge label={node.adapterType} variant="accent" />
        </div>
        <div className="flex justify-between">
          <span>Uptime</span>
          <span>{node.uptime}s</span>
        </div>
        <div className="flex justify-between">
          <span>Hops</span>
          <span>{node.hopCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Last seen</span>
          <span>{formatDateTime(node.lastSeen)}</span>
        </div>
      </div>
    </Link>
  );
}
