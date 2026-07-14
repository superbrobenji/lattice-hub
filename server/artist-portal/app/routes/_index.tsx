import { useState } from "react";
import { useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { getNodes, getStatus, getZones } from "../services/orchestrator.server";
import { NodeCard } from "../components/features/NodeCard";
import { EventFeed } from "../components/features/EventFeed";
import { NodeMap } from "../components/features/NodeMap";
import { useLiveMesh } from "../hooks/useLiveMesh";
import { StatusDot } from "../components/ui/StatusDot";
import type { Node, Zone } from "../types/nodes";

export const meta: MetaFunction = () => [
  { title: "Live Tracker — Lattice Artist Portal" },
];

export async function loader(_: LoaderFunctionArgs) {
  const [nodesResult, statusResult, zonesResult] = await Promise.allSettled([
    getNodes(),
    getStatus(),
    getZones(),
  ]);
  const nodes: Node[] = nodesResult.status === "fulfilled" ? nodesResult.value : [];
  const serverOnline: boolean =
    statusResult.status === "fulfilled"
      ? statusResult.value.mesh.masterOnline
      : false;
  const zones: Zone[] = zonesResult.status === "fulfilled" ? zonesResult.value : [];
  return { nodes, serverOnline, zones };
}

type Tab = "list" | "map";

export default function TrackerPage() {
  const { nodes: initialNodes, serverOnline: initialOnline, zones } =
    useLoaderData<typeof loader>();
  const { nodes, events, serverOnline, refreshNodes } = useLiveMesh(initialNodes, initialOnline);
  const [tab, setTab] = useState<Tab>("list");

  const bannerCls =
    serverOnline === null
      ? "bg-surface text-muted border border-border"
      : serverOnline
        ? "bg-ok/10 text-ok border border-ok/20"
        : "bg-danger/10 text-danger border border-danger/20";

  const bannerLabel =
    serverOnline === null
      ? "Connecting…"
      : serverOnline
        ? "Connected to mesh"
        : "Disconnected from mesh";

  return (
    <div>
      {/* Connection banner */}
      <div className={`flex items-center gap-2 mb-6 px-4 py-2.5 rounded-lg text-sm font-medium ${bannerCls}`}>
        {serverOnline !== null && (
          <StatusDot status={serverOnline ? "ok" : "error"} size="sm" />
        )}
        {bannerLabel}
      </div>

      {/* Sub-tab toggle */}
      <div className="flex gap-1 mb-6 bg-surface rounded-lg p-1 w-fit border border-border">
        {(["list", "map"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
              tab === t ? "bg-elevated text-white" : "text-muted hover:text-white"
            }`}
          >
            {t === "list" ? "Node List" : "Mesh Map"}
          </button>
        ))}
      </div>

      {tab === "list" ? (
        <>
          {nodes.length === 0 ? (
            <p className="text-sm text-muted mb-8">No nodes registered.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 mb-8">
              {nodes.map((n) => (
                <NodeCard key={n.id} node={n} />
              ))}
            </div>
          )}
          <h2 className="text-[10px] font-semibold text-muted uppercase tracking-widest mb-3">
            Event Feed
          </h2>
          <EventFeed events={events} />
        </>
      ) : (
        <NodeMap
          nodes={nodes}
          serverOnline={serverOnline ?? false}
          zones={zones}
          onEdit={refreshNodes}
        />
      )}
    </div>
  );
}
