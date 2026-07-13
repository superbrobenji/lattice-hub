import { useEffect } from "react";
import { useState } from "react";
import type { Node } from "../../types/nodes";
import { StatusDot } from "../ui/StatusDot";
import { Badge } from "../ui/Badge";
import { sendNodeCommand } from "../../services/api";

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

function PanelCommands({ node }: { node: Node }) {
  const [ledColour, setLedColour] = useState("#ff6400");
  const hexToRgb = (hex: string): number[] => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];

  if (node.type === "led") {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={ledColour}
            onChange={(e) => setLedColour(e.target.value)}
            className="h-7 w-10 rounded cursor-pointer bg-transparent border border-border p-0"
          />
          <button
            onClick={() => sendNodeCommand(node.id, "led_solid", hexToRgb(ledColour))}
            className="flex-1 px-3 py-1.5 text-xs bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
          >
            LED On
          </button>
        </div>
        <button
          onClick={() => sendNodeCommand(node.id, "led_off")}
          className="w-full px-3 py-1.5 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
        >
          LED Off
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        onClick={() => sendNodeCommand(node.id, "relay_on")}
        className="w-full px-3 py-1.5 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors"
      >
        Relay On
      </button>
      <button
        onClick={() => sendNodeCommand(node.id, "relay_off")}
        className="w-full px-3 py-1.5 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
      >
        Relay Off
      </button>
    </div>
  );
}

interface Props {
  node: Node;
  onClose: () => void;
}

export function NodeDetailPanel({ node, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const isOutput = node.type === "led" || node.type === "relay";

  return (
    <div className="absolute right-0 top-0 h-full w-72 bg-surface border-l border-border flex flex-col z-10 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold truncate pr-2">
          {node.name || `Node ${node.id}`}
        </h3>
        <button
          onClick={onClose}
          className="text-muted hover:text-white transition-colors shrink-0 text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <Row label="Node ID" value={node.id} />
        <Row label="Zone" value={<Badge variant="zone">{node.zone || "unzoned"}</Badge>} />
        <Row label="Type" value={<Badge variant="type">{node.type}</Badge>} />
        <Row
          label="Status"
          value={
            <span className="flex items-center gap-2">
              <StatusDot status={node.online ? "ok" : "error"} size="sm" />
              {node.online ? "online" : "offline"}
            </span>
          }
        />
        <Row label="Hop Count" value={node.hopCount} />
        <Row label="Uptime" value={formatUptime(node.uptime)} />
        <Row label="Last Seen" value={formatRelative(node.lastSeen)} />
      </div>

      {isOutput && (
        <div className="px-4 py-4 border-t border-border shrink-0">
          <p className="text-[10px] text-muted uppercase tracking-wider mb-3">Commands</p>
          <PanelCommands node={node} />
        </div>
      )}
    </div>
  );
}
