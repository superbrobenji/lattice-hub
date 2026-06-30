import type { Node } from "../services/api";

export function NodeGrid({ nodes }: { nodes: Node[] }) {
  if (!nodes.length) return <p>No nodes registered.</p>;
  return (
    <div className="node-grid">
      {nodes.map((n) => (
        <div key={n.id} className={`node-card ${n.online ? "online" : "offline"}`}>
          <span className="node-name">{n.name || `Node ${n.id}`}</span>
          <span className="node-zone">{n.zone || "unzoned"}</span>
          <span className="node-type">{n.adapterType}</span>
          <span className="node-status">{n.online ? "online" : "offline"}</span>
          <span className="node-uptime">{n.uptime}s uptime</span>
        </div>
      ))}
    </div>
  );
}
