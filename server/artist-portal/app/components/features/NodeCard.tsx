import { useState } from "react";
import type { Node } from "../../types/nodes";
import { StatusDot } from "../ui/StatusDot";
import { Badge } from "../ui/Badge";
import { sendNodeCommand } from "../../services/api";

function formatUptime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function NodeCommands({ node }: { node: Node }) {
  const [ledColour, setLedColour] = useState("#ff6400");
  const hexToRgb = (hex: string): number[] => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  };

  if (node.type === "led") {
    return (
      <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
        <div className="flex items-center gap-1.5 flex-1">
          <input
            type="color"
            value={ledColour}
            onChange={(e) => setLedColour(e.target.value)}
            className="h-7 w-10 rounded cursor-pointer bg-transparent border border-border p-0"
            title="Pick colour"
          />
          <button
            onClick={() => sendNodeCommand(node.id, "led_solid", hexToRgb(ledColour))}
            className="px-2 py-1 text-xs bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
          >
            On
          </button>
        </div>
        <button
          onClick={() => sendNodeCommand(node.id, "led_off")}
          className="px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
        >
          Off
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 pt-3 border-t border-border">
      <button
        onClick={() => sendNodeCommand(node.id, "relay_on")}
        className="flex-1 px-2 py-1 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors"
      >
        Relay On
      </button>
      <button
        onClick={() => sendNodeCommand(node.id, "relay_off")}
        className="flex-1 px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
      >
        Relay Off
      </button>
    </div>
  );
}

export function NodeCard({ node }: { node: Node }) {
  const isOutput = node.type === "led" || node.type === "relay";

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {node.name || `Node ${node.id}`}
          </p>
          <p className="text-xs text-muted mt-0.5">ID: {node.id}</p>
        </div>
        <StatusDot status={node.online ? "ok" : "error"} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Badge variant="zone">{node.zone || "unzoned"}</Badge>
        <Badge variant="type">{node.type}</Badge>
      </div>

      <div className="grid grid-cols-2 gap-y-2 text-xs">
        <div>
          <p className="text-muted">Hops</p>
          <p className="text-white font-medium">{node.hopCount}</p>
        </div>
        <div>
          <p className="text-muted">Uptime</p>
          <p className="text-white font-medium">{formatUptime(node.uptime)}</p>
        </div>
        <div className="col-span-2">
          <p className="text-muted">Last seen</p>
          <p className="text-white font-medium">{formatRelative(node.lastSeen)}</p>
        </div>
      </div>

      {isOutput && <NodeCommands node={node} />}
    </div>
  );
}
