import { useState } from "react";
import { useLoaderData } from "react-router";
import type { MetaFunction } from "react-router";
import {
  getPendingEnrollments,
  getAllEnrollments,
  getZones,
  getStatus,
} from "../services/orchestrator.server";
import { EnrollmentTable } from "../components/features/EnrollmentTable";
import type { Enrollment, Zone } from "../types/nodes";

export const meta: MetaFunction = () => [
  { title: "Enrollments — Lattice Artist Portal" },
];

export async function loader() {
  const [pendingResult, allResult, zonesResult, statusResult] = await Promise.allSettled([
    getPendingEnrollments(),
    getAllEnrollments(),
    getZones(),
    getStatus(),
  ]);
  const pending: Enrollment[] = pendingResult.status === "fulfilled" ? pendingResult.value : [];
  const all: Enrollment[] = allResult.status === "fulfilled" ? allResult.value : [];
  const zones: Zone[] = zonesResult.status === "fulfilled" ? zonesResult.value : [];
  const nextFreeId: number =
    statusResult.status === "fulfilled" ? statusResult.value.nodes.nextFreeId : 0;
  return { pending, all, zones, nextFreeId };
}

type Tab = "pending" | "all";

export default function EnrollmentsPage() {
  const { pending, all, zones, nextFreeId } = useLoaderData<typeof loader>();
  const [tab, setTab] = useState<Tab>("pending");

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-lg font-semibold">Enrollments</h1>
        {pending.length > 0 && (
          <span className="px-2 py-0.5 text-xs bg-warn/20 border border-warn/40 text-warn rounded-full font-medium">
            {pending.length} pending
          </span>
        )}
      </div>

      <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 w-fit border border-border">
        {(["pending", "all"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t ? "bg-elevated text-white" : "text-muted hover:text-white"
            }`}
          >
            {t === "pending" ? `Pending${pending.length > 0 ? ` (${pending.length})` : ""}` : "All"}
          </button>
        ))}
      </div>

      <EnrollmentTable
        enrollments={tab === "pending" ? pending : all}
        zones={zones}
        nextFreeId={nextFreeId}
        showActions={tab === "pending"}
      />
    </div>
  );
}
