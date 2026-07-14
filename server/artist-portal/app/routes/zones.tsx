import { useState } from "react";
import { useLoaderData, useFetcher } from "react-router";
import type { ActionFunctionArgs, MetaFunction } from "react-router";
import { getZones, getNodes, createZone } from "../services/orchestrator.server";
import { ZoneCard } from "../components/features/ZoneCard";
import type { Zone, Node } from "../types/nodes";

export const meta: MetaFunction = () => [
  { title: "Zones — Lattice Artist Portal" },
];

export async function loader() {
  const [zonesResult, nodesResult] = await Promise.allSettled([getZones(), getNodes()]);
  const zones: Zone[] = zonesResult.status === "fulfilled" ? zonesResult.value : [];
  const nodes: Node[] = nodesResult.status === "fulfilled" ? nodesResult.value : [];
  return { zones, nodes };
}

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as { name: string };
  try {
    const zone = await createZone(body.name.trim());
    return Response.json({ ok: true, zone });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}

export default function ZonesPage() {
  const { zones, nodes } = useLoaderData<typeof loader>();
  const createFetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [newName, setNewName] = useState("");

  const nodesByZone = (zoneId: string) => nodes.filter((n) => n.zone === zoneId);

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    createFetcher.submit(
      JSON.stringify({ name: newName.trim() }),
      { method: "POST", action: "/zones", encType: "application/json" },
    );
    setNewName("");
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold">Zones</h1>
        <span className="text-sm text-muted">{zones.length} zone{zones.length !== 1 ? "s" : ""}</span>
      </div>

      <form onSubmit={submitCreate} className="flex gap-2 mb-6">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New zone name"
          className="flex-1 bg-surface border border-border rounded px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={!newName.trim() || createFetcher.state === "submitting"}
          className="px-4 py-1.5 text-sm bg-accent/10 border border-accent/30 text-accent rounded hover:bg-accent/20 transition-colors disabled:opacity-50"
        >
          {createFetcher.state === "submitting" ? "Creating…" : "Create"}
        </button>
      </form>

      {createFetcher.data?.error && (
        <p className="text-sm text-danger mb-4">{createFetcher.data.error}</p>
      )}

      {zones.length === 0 ? (
        <p className="text-sm text-muted">No zones yet.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {zones.map((zone) => (
            <ZoneCard key={zone.id} zone={zone} nodes={nodesByZone(zone.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
