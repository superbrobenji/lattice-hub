import { useState } from "react";
import { data } from "react-router";
import type { Route } from "./+types/_auth.enrollments";
import { requireAuth } from "~/services/auth.server";
import { orchestrator } from "~/services/orchestrator.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { Badge } from "~/components/ui/Badge";
import { DataTable } from "~/components/ui/DataTable";
import type { Column } from "~/components/ui/DataTable";
import type { IEnrollment } from "~/types/nodes";
import { fromUnix } from "~/utils/formatDateTime";

const STATUS_LABELS = { 0: "Pending", 1: "Approved", 2: "Rejected" } as const;
const STATUS_VARIANTS = { 0: "warn", 1: "ok", 2: "danger" } as const;

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const enrollments = await orchestrator.getPendingEnrollments();
  return { enrollments };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAuth(request);
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const mac = String(form.get("mac"));

  if (intent === "approve") {
    const name = String(form.get("name") ?? "").trim();
    const zone = String(form.get("zone") ?? "").trim() || undefined;
    await orchestrator.approveEnrollment(mac, { name: name || undefined, zone });
  } else if (intent === "reject") {
    await orchestrator.rejectEnrollment(mac);
  } else {
    return data({ error: "Unknown action" }, { status: 400 });
  }
  return null;
}

export default function Enrollments({ loaderData }: Route.ComponentProps) {
  const { enrollments } = loaderData;
  const [openMac, setOpenMac] = useState<string | null>(null);

  const columns: Column<IEnrollment>[] = [
    {
      key: "mac",
      header: "MAC",
      render: (e) => <span className="font-mono text-xs">{e.mac}</span>,
    },
    {
      key: "publicKey",
      header: "Public Key",
      render: (e) => (
        <span className="font-mono text-xs text-muted">
          {e.publicKey.substring(0, 16)}…
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => (
        <Badge label={STATUS_LABELS[e.status]} variant={STATUS_VARIANTS[e.status]} />
      ),
    },
    {
      key: "receivedAt",
      header: "Received",
      render: (e) => <span className="text-xs text-muted">{fromUnix(e.receivedAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (e) =>
        e.status === 0 ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpenMac(e.mac)}
              className="text-xs px-2 py-1 rounded bg-ok/20 text-ok hover:bg-ok/30 transition-colors"
            >
              Approve
            </button>
            <form method="post">
              <input type="hidden" name="intent" value="reject" />
              <input type="hidden" name="mac" value={e.mac} />
              <button
                type="submit"
                className="text-xs px-2 py-1 rounded bg-danger/20 text-danger hover:bg-danger/30 transition-colors"
              >
                Reject
              </button>
            </form>
          </div>
        ) : null,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Enrollments"
        description="Approve or reject node enrollment requests"
      />
      <DataTable
        columns={columns}
        rows={enrollments}
        keyField="mac"
        emptyMessage="No enrollment requests"
      />

      {openMac && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface border border-border rounded-lg p-6 min-w-[320px]">
            <h2 className="text-lg font-semibold text-text mb-4">Approve {openMac}</h2>
            {/*
              No onSubmit handler here: this is a plain browser POST that
              navigates/reloads the page (React Router v8 action + full
              document response), so the loader re-runs with fresh data and
              openMac naturally resets to null on remount. Synchronously
              clearing openMac in onSubmit would unmount this <form> mid-submit
              and the browser cancels the submission ("Form submission
              canceled because the form is not connected") — reproduced while
              verifying this against the live stack.
            */}
            <form method="post">
              <input type="hidden" name="intent" value="approve" />
              <input type="hidden" name="mac" value={openMac} />
              <div className="mb-3">
                <label htmlFor="approve-name" className="block text-xs text-muted mb-1.5">
                  Name
                </label>
                <input
                  id="approve-name"
                  name="name"
                  required
                  autoFocus
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="mb-4">
                <label htmlFor="approve-zone" className="block text-xs text-muted mb-1.5">
                  Zone (optional)
                </label>
                <input
                  id="approve-zone"
                  name="zone"
                  className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpenMac(null)}
                  className="text-xs px-3 py-1.5 rounded bg-elevated text-muted hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 rounded bg-ok/20 text-ok hover:bg-ok/30 transition-colors"
                >
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
