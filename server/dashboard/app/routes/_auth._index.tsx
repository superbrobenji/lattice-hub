import type { Route } from "./+types/_auth._index";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";
import { orchestrator } from "~/services/orchestrator.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { ServiceCard } from "~/components/features/ServiceCard";
import { usePolling } from "~/hooks/usePolling";
import type { HealthReport } from "~/types/health";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const [health, nodes, enrollments] = await Promise.allSettled([
    sidecar.getServicesHealth(),
    orchestrator.getNodes(),
    orchestrator.getPendingEnrollments(),
  ]);
  return {
    health: health.status === "fulfilled" ? health.value : { services: [] },
    nodeCount: nodes.status === "fulfilled" ? nodes.value.length : 0,
    pendingCount:
      enrollments.status === "fulfilled"
        ? enrollments.value.filter((e) => e.status === 0).length
        : 0,
  };
}

export default function Overview({ loaderData }: Route.ComponentProps) {
  const { health, nodeCount, pendingCount } = loaderData;
  const { data: polled } = usePolling<typeof loaderData>("/", 30_000);
  const activeHealth: HealthReport = polled?.health ?? health;

  const unhealthyCount = activeHealth.services.filter(
    (s) => s.dockerState !== "running" || s.dockerHealth === "unhealthy"
  ).length;
  const total = activeHealth.services.length;

  const kafkaDetail = activeHealth.services.find((s) => s.name === "kafka")?.detail as
    | Record<string, unknown>
    | undefined;
  const partitionCount = typeof kafkaDetail?.partitions === "number" ? kafkaDetail.partitions : "—";

  return (
    <div>
      <PageHeader title="Overview" />

      {/* Summary bar */}
      <div
        className={`mb-6 px-4 py-3 rounded-lg border text-sm font-medium ${
          unhealthyCount === 0
            ? "border-ok/30 bg-ok/10 text-ok"
            : "border-danger/30 bg-danger/10 text-danger"
        }`}
      >
        {unhealthyCount === 0
          ? `${total}/${total} services healthy`
          : `${total - unhealthyCount}/${total} services healthy — ${unhealthyCount} unhealthy`}
      </div>

      {/* Health grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
        {activeHealth.services.map((svc) => (
          <ServiceCard key={svc.name} service={svc} />
        ))}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Active nodes", value: nodeCount },
          { label: "Pending enrollments", value: pendingCount },
          { label: "Kafka partitions", value: partitionCount },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface border border-border rounded-lg p-4"
          >
            <p className="text-xs text-muted">{stat.label}</p>
            <p className="text-2xl font-semibold text-text mt-1">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
