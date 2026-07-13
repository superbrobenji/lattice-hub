import { useOutlet } from "react-router";
import type { Route } from "./+types/_auth.infrastructure";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { StatusDot } from "~/components/ui/StatusDot";
import { ContainerRow } from "~/components/features/ContainerRow";
import { usePolling } from "~/hooks/usePolling";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const [containers, kafka] = await Promise.allSettled([
    sidecar.getContainers(),
    sidecar.getKafkaStatus(),
  ]);
  return {
    containers: containers.status === "fulfilled" ? containers.value : [],
    kafka: kafka.status === "fulfilled" ? kafka.value : null,
  };
}

export default function Infrastructure({ loaderData }: Route.ComponentProps) {
  const outlet = useOutlet();
  if (outlet) return <>{outlet}</>;
  const { containers, kafka } = loaderData;
  const { data: polled } = usePolling<typeof loaderData>("/infrastructure", 15_000);
  const activeContainers = polled?.containers ?? containers;
  const activeKafka = polled?.kafka ?? kafka;

  return (
    <div className="space-y-8">
      <PageHeader title="Infrastructure" description="Project containers and message broker" />

      {/* Containers */}
      <section>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Containers
        </h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-elevated">
                {["Name", "Image", "State", "Status", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeContainers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    No project containers found
                  </td>
                </tr>
              ) : (
                activeContainers.map((c) => (
                  <ContainerRow
                    key={c.id}
                    container={c}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Kafka */}
      <section>
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">
          Kafka
        </h2>
        <div className="bg-surface border border-border rounded-lg p-4">
          {activeKafka ? (
            <div className="flex items-center gap-4 text-sm">
              <StatusDot variant={activeKafka.reachable ? "ok" : "error"} />
              <span className="text-text">
                {activeKafka.reachable ? "Reachable" : "Unreachable"}
              </span>
              {activeKafka.broker && (
                <span className="text-muted font-mono">{activeKafka.broker}</span>
              )}
              {activeKafka.partitions !== undefined && (
                <span className="text-muted">{activeKafka.partitions} partitions</span>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted">Kafka status unavailable</p>
          )}
        </div>
      </section>
    </div>
  );
}
