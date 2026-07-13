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
    await orchestrator.approveEnrollment(mac, {});
  } else if (intent === "reject") {
    await orchestrator.rejectEnrollment(mac);
  } else {
    return data({ error: "Unknown action" }, { status: 400 });
  }
  return null;
}

export default function Enrollments({ loaderData }: Route.ComponentProps) {
  const { enrollments } = loaderData;

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
            <form method="post">
              <input type="hidden" name="intent" value="approve" />
              <input type="hidden" name="mac" value={e.mac} />
              <button
                type="submit"
                className="text-xs px-2 py-1 rounded bg-ok/20 text-ok hover:bg-ok/30 transition-colors"
              >
                Approve
              </button>
            </form>
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
    </div>
  );
}
