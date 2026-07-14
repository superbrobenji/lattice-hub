import { useState } from "react";
import { useFetcher } from "react-router";
import type { Zone, Node } from "../../types/nodes";
import { InlineEdit } from "../ui/InlineEdit";
import { sendZoneCommand } from "../../services/api";

interface Props {
  zone: Zone;
  nodes: Node[];
}

const MAX_VISIBLE_NAMES = 5;

const hexToRgb = (hex: string): number[] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export function ZoneCard({ zone, nodes }: Props) {
  const renameFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const deleteFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ledColour, setLedColour] = useState("#ff6400");

  const hasOutputNodes = nodes.some((n) => n.type === "led" || n.type === "relay");
  const hasLed = nodes.some((n) => n.type === "led");
  const hasRelay = nodes.some((n) => n.type === "relay");
  const overflow = nodes.length - MAX_VISIBLE_NAMES;

  return (
    <div className="bg-surface border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-accent/40 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <InlineEdit
            value={zone.name}
            onSave={(name) =>
              renameFetcher.submit(
                JSON.stringify({ id: zone.id, name }),
                { method: "POST", action: "/zones-update", encType: "application/json" },
              )
            }
            disabled={renameFetcher.state === "submitting"}
          />
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          title={nodes.length > 0 ? "Move nodes to another zone first" : "Delete zone"}
          disabled={nodes.length > 0}
          className="text-muted hover:text-danger transition-colors text-sm disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
        >
          🗑
        </button>
      </div>

      <p className="text-xs text-muted">
        {nodes.length} node{nodes.length !== 1 ? "s" : ""}
      </p>

      {nodes.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {nodes.slice(0, MAX_VISIBLE_NAMES).map((n) => (
            <span key={n.id} className="px-1.5 py-0.5 text-[10px] bg-elevated border border-border rounded text-muted">
              {n.name || `Node ${n.id}`}
            </span>
          ))}
          {overflow > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] bg-elevated border border-border rounded text-muted">
              +{overflow} more
            </span>
          )}
        </div>
      )}

      {confirmDelete && (
        <div className="bg-danger/10 border border-danger/20 rounded p-2 space-y-2">
          <p className="text-xs text-danger">Delete zone "{zone.name}"?</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                deleteFetcher.submit(
                  JSON.stringify({ id: zone.id }),
                  { method: "POST", action: "/zones-delete", encType: "application/json" },
                )
              }
              disabled={deleteFetcher.state === "submitting"}
              className="flex-1 px-2 py-1 text-xs bg-danger/20 border border-danger/40 text-danger rounded hover:bg-danger/30 disabled:opacity-50"
            >
              {deleteFetcher.state === "submitting" ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white"
            >
              Cancel
            </button>
          </div>
          {deleteFetcher.data?.error && (
            <p className="text-xs text-danger">{deleteFetcher.data.error}</p>
          )}
        </div>
      )}

      {renameFetcher.data?.error && (
        <p className="text-xs text-danger">{renameFetcher.data.error}</p>
      )}

      {hasOutputNodes && (
        <div className="flex flex-wrap gap-2 pt-3 border-t border-border">
          {hasLed && (
            <>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={ledColour}
                  onChange={(e) => setLedColour(e.target.value)}
                  className="h-7 w-10 rounded cursor-pointer bg-transparent border border-border p-0"
                  title="Pick colour"
                />
                <button
                  onClick={() => sendZoneCommand(zone.id, "led_solid", hexToRgb(ledColour))}
                  className="px-2 py-1 text-xs bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors"
                >
                  LED On
                </button>
              </div>
              <button
                onClick={() => sendZoneCommand(zone.id, "led_off")}
                className="px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
              >
                LED Off
              </button>
            </>
          )}
          {hasRelay && (
            <>
              <button
                onClick={() => sendZoneCommand(zone.id, "relay_on")}
                className="px-2 py-1 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors"
              >
                Relay On
              </button>
              <button
                onClick={() => sendZoneCommand(zone.id, "relay_off")}
                className="px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
              >
                Relay Off
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
