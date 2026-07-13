import type { Route } from "./+types/_auth.nodes";
import { requireAuth } from "~/services/auth.server";
import { orchestrator } from "~/services/orchestrator.server";
import { PageHeader } from "~/components/layout/PageHeader";
import { NodeCard } from "~/components/features/NodeCard";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const nodes = await orchestrator.getNodes();
  return { nodes };
}

export default function Nodes({ loaderData }: Route.ComponentProps) {
  const { nodes } = loaderData;
  return (
    <div>
      <PageHeader
        title="Nodes"
        description={`${nodes.length} node${nodes.length !== 1 ? "s" : ""} registered`}
      />
      {nodes.length === 0 ? (
        <p className="text-muted text-sm">No nodes registered yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {nodes.map((node) => (
            <NodeCard key={node.id} node={node} />
          ))}
        </div>
      )}
    </div>
  );
}
