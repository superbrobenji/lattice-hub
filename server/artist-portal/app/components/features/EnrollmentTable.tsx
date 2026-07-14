import { useState } from "react";
import { useFetcher } from "react-router";
import type { Enrollment, Zone } from "../../types/nodes";
import { SlidePanel } from "../ui/SlidePanel";
import { Badge } from "../ui/Badge";

const STATUS_LABELS: Record<number, string> = {
  0: "pending",
  1: "approved",
  2: "rejected",
};

const STATUS_VARIANTS: Record<number, "zone" | "type"> = {
  0: "type",
  1: "zone",
  2: "type",
};

interface Props {
  enrollments: Enrollment[];
  zones: Zone[];
  nextFreeId: number;
  showActions?: boolean;
}

interface ApproveFormState {
  mac: string;
  name: string;
  zone: string;
  type: string;
  nodeId: string;
}

const DEFAULT_TYPES = ["pir", "led", "relay", "unknown"];

export function EnrollmentTable({ enrollments, zones, nextFreeId, showActions }: Props) {
  const approveFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const rejectFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [approveForm, setApproveForm] = useState<ApproveFormState | null>(null);
  const [confirmReject, setConfirmReject] = useState<string | null>(null);

  function openApprove(enrollment: Enrollment) {
    setApproveForm({
      mac: enrollment.mac,
      name: "",
      zone: "",
      type: "unknown",
      nodeId: String(nextFreeId || ""),
    });
  }

  function submitApprove(e: { preventDefault: () => void }) {
    e.preventDefault();
    if (!approveForm) return;
    approveFetcher.submit(
      JSON.stringify({
        mac: approveForm.mac,
        name: approveForm.name || undefined,
        zone: approveForm.zone || undefined,
        type: approveForm.type || undefined,
        nodeId: approveForm.nodeId ? parseInt(approveForm.nodeId, 10) : undefined,
      }),
      { method: "POST", action: "/enrollments-approve", encType: "application/json" },
    );
  }

  // Close panel on success
  const approveSubmitting = approveFetcher.state === "submitting";
  if (approveFetcher.data?.ok && approveForm) setApproveForm(null);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider">MAC</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider">Public Key</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider">Received</th>
              <th className="pb-2 pr-4 text-xs font-semibold text-muted uppercase tracking-wider">Status</th>
              {showActions && <th className="pb-2 text-xs font-semibold text-muted uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {enrollments.map((e) => (
              <tr key={e.mac} className="border-b border-border/40 hover:bg-elevated/30">
                <td className="py-2 pr-4 font-mono text-xs text-white">{e.mac}</td>
                <td className="py-2 pr-4 font-mono text-xs text-muted">
                  {e.publicKey.slice(0, 8)}…
                </td>
                <td className="py-2 pr-4 text-xs text-muted">
                  {new Date(e.receivedAt * 1000).toLocaleString()}
                </td>
                <td className="py-2 pr-4">
                  <Badge variant={STATUS_VARIANTS[e.status] ?? "type"}>
                    {STATUS_LABELS[e.status] ?? "unknown"}
                  </Badge>
                </td>
                {showActions && e.status === 0 && (
                  <td className="py-2">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openApprove(e)}
                        className="px-2 py-1 text-xs bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors"
                      >
                        Approve
                      </button>
                      {confirmReject === e.mac ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => {
                              rejectFetcher.submit(
                                JSON.stringify({ mac: e.mac }),
                                { method: "POST", action: "/enrollments-reject", encType: "application/json" },
                              );
                              setConfirmReject(null);
                            }}
                            className="px-2 py-1 text-xs bg-danger/20 border border-danger/40 text-danger rounded hover:bg-danger/30"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setConfirmReject(null)}
                            className="px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmReject(e.mac)}
                          className="px-2 py-1 text-xs bg-elevated border border-border text-muted rounded hover:text-danger transition-colors"
                        >
                          Reject
                        </button>
                      )}
                    </div>
                  </td>
                )}
                {showActions && e.status !== 0 && <td />}
              </tr>
            ))}
          </tbody>
        </table>
        {enrollments.length === 0 && (
          <p className="text-sm text-muted py-4">None.</p>
        )}
      </div>

      <SlidePanel
        open={approveForm !== null}
        onClose={() => setApproveForm(null)}
        title={`Approve: ${approveForm?.mac ?? ""}`}
      >
        <form onSubmit={submitApprove} className="px-4 py-4 space-y-4">
          <div>
            <label className="text-xs text-muted block mb-1">Name (optional)</label>
            <input
              type="text"
              value={approveForm?.name ?? ""}
              onChange={(e) => setApproveForm((f) => f && { ...f, name: e.target.value })}
              className="w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
              placeholder="e.g. entrance-left"
            />
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Zone</label>
            <select
              value={approveForm?.zone ?? ""}
              onChange={(e) => setApproveForm((f) => f && { ...f, zone: e.target.value })}
              className="w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
            >
              <option value="">unzoned</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Type</label>
            <select
              value={approveForm?.type ?? "unknown"}
              onChange={(e) => setApproveForm((f) => f && { ...f, type: e.target.value })}
              className="w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
            >
              {DEFAULT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Node ID (1–255)</label>
            <input
              type="number"
              min={1}
              max={255}
              value={approveForm?.nodeId ?? ""}
              onChange={(e) => setApproveForm((f) => f && { ...f, nodeId: e.target.value })}
              className="w-full bg-elevated border border-border rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-accent"
            />
          </div>

          {approveFetcher.data?.error && (
            <p className="text-xs text-danger">{approveFetcher.data.error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={approveSubmitting}
              className="flex-1 py-2 text-sm bg-ok/10 border border-ok/30 text-ok rounded hover:bg-ok/20 transition-colors disabled:opacity-50"
            >
              {approveSubmitting ? "Approving…" : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => setApproveForm(null)}
              className="flex-1 py-2 text-sm bg-elevated border border-border text-muted rounded hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </SlidePanel>
    </>
  );
}
