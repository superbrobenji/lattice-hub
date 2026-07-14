import { useEffect, useState } from "react";
import { useFetcher } from "react-router";
import type { Node, Zone } from "../../types/nodes";
import { StatusDot } from "../ui/StatusDot";
import { Badge } from "../ui/Badge";
import { InlineEdit } from "../ui/InlineEdit";
import { sendNodeCommand } from "../../services/api";

const NODE_TYPES = ["pir", "led", "relay", "serial", "unknown"] as const;

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
  zones: Zone[];
  onClose: () => void;
  onEdit: () => void;
}

export function NodeDetailPanel({ node, zones, onClose, onEdit }: Props) {
  const editFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const deleteFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    if (editFetcher.data?.ok) onEdit();
  }, [editFetcher.data, onEdit]);

  useEffect(() => {
    if (deleteFetcher.data?.ok) { onClose(); onEdit(); }
  }, [deleteFetcher.data, onClose, onEdit]);

  function patchNode(patch: { name?: string; zone?: string; type?: string }) {
    editFetcher.submit(
      JSON.stringify({ id: node.id, ...patch }),
      { method: "POST", action: "/nodes-patch", encType: "application/json" },
    );
  }

  const isOutput = node.type === "led" || node.type === "relay";
  const submitting = editFetcher.state === "submitting";
  const deleting = deleteFetcher.state === "submitting";

  return (
    <div className="absolute right-0 top-0 h-full w-72 bg-surface border-l border-border flex flex-col z-10 shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold truncate pr-2">
          {node.name || `Node ${node.id}`}
        </h3>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-muted hover:text-danger transition-colors text-sm leading-none"
            aria-label="Delete node"
            title="Delete node"
          >
            🗑
          </button>
          <button
            onClick={onClose}
            className="text-muted hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="px-4 py-3 bg-danger/10 border-b border-danger/20 shrink-0">
          <p className="text-xs text-danger mb-2">Delete this node?</p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                deleteFetcher.submit(
                  JSON.stringify({ id: node.id }),
                  { method: "POST", action: "/nodes-delete", encType: "application/json" },
                );
              }}
              disabled={deleting}
              className="flex-1 px-2 py-1 text-xs bg-danger/20 border border-danger/40 text-danger rounded hover:bg-danger/30 transition-colors disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
          {deleteFetcher.data?.error && (
            <p className="text-xs text-danger mt-1">{deleteFetcher.data.error}</p>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 py-2">
        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-xs text-muted">Name</span>
          <div className="w-36">
            <InlineEdit
              value={node.name || `Node ${node.id}`}
              onSave={(name) => patchNode({ name })}
              disabled={submitting}
            />
          </div>
        </div>

        <Row label="Node ID" value={node.id} />

        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-xs text-muted">Zone</span>
          <select
            value={node.zone || ""}
            onChange={(e) => patchNode({ zone: e.target.value })}
            disabled={submitting}
            className="bg-elevated border border-border rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-accent disabled:opacity-50"
          >
            <option value="">unzoned</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-border/50">
          <span className="text-xs text-muted">Type</span>
          <select
            value={node.type}
            onChange={(e) => patchNode({ type: e.target.value })}
            disabled={submitting}
            className="bg-elevated border border-border rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-accent disabled:opacity-50"
          >
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

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

        {editFetcher.data?.error && (
          <p className="text-xs text-danger mt-2">{editFetcher.data.error}</p>
        )}
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
