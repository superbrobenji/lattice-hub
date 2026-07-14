import { describe, it, expect } from "vitest";
import { inferEdges, buildFlowNodes } from "./topology";
import type { Node } from "../types/nodes";

const n = (partial: Partial<Node> & { id: number; hopCount: number }): Node => ({
  name: `Node ${partial.id}`,
  zone: "default",
  type: "pir",
  online: true,
  uptime: 0,
  lastSeen: new Date().toISOString(),
  ...partial,
});

describe("inferEdges", () => {
  it("returns empty array for no nodes", () => {
    expect(inferEdges([], true)).toHaveLength(0);
  });

  it("connects hopCount=1 nodes to master", () => {
    const edges = inferEdges([n({ id: 1, hopCount: 1 })], true);
    expect(edges).toHaveLength(1);
    expect(edges[0].source).toBe("master");
    expect(edges[0].target).toBe("1");
  });

  it("edge is white (#ffffff) when both master and node online", () => {
    const edges = inferEdges([n({ id: 1, hopCount: 1, online: true })], true);
    expect((edges[0].style as { stroke: string }).stroke).toBe("#ffffff");
  });

  it("edge is red (#ef4444) when master offline", () => {
    const edges = inferEdges([n({ id: 1, hopCount: 1, online: true })], false);
    expect((edges[0].style as { stroke: string }).stroke).toBe("#ef4444");
  });

  it("edge is red when node offline", () => {
    const edges = inferEdges([n({ id: 1, hopCount: 1, online: false })], true);
    expect((edges[0].style as { stroke: string }).stroke).toBe("#ef4444");
  });

  it("connects hopCount=2 to same-zone hopCount=1 parent", () => {
    const nodes = [
      n({ id: 1, hopCount: 1, zone: "entrance" }),
      n({ id: 2, hopCount: 1, zone: "lounge" }),
      n({ id: 3, hopCount: 2, zone: "entrance" }),
    ];
    const edges = inferEdges(nodes, true);
    const h2edge = edges.find((e) => e.target === "3");
    expect(h2edge?.source).toBe("1");
  });

  it("falls back to first alphabetical hopCount=1 when no zone match", () => {
    const nodes = [
      n({ id: 1, hopCount: 1, zone: "lounge", name: "Bravo" }),
      n({ id: 2, hopCount: 1, zone: "entrance", name: "Alpha" }),
      n({ id: 3, hopCount: 2, zone: "kitchen" }),
    ];
    const edges = inferEdges(nodes, true);
    const h2edge = edges.find((e) => e.target === "3");
    expect(h2edge?.source).toBe("2"); // Alpha sorts before Bravo
  });

  it("uses parentId when present (exact route known)", () => {
    // Node 3 at hop 2 with parentId=2 — should connect to node 2 regardless of zone
    const nodes = [
      n({ id: 1, hopCount: 1, zone: "zone-a" }),
      n({ id: 2, hopCount: 1, zone: "zone-b" }),
      n({ id: 3, hopCount: 2, zone: "zone-a", parentId: 2 }),
    ];
    const edges = inferEdges(nodes, true);
    const h2edge = edges.find((e) => e.target === "3");
    expect(h2edge?.source).toBe("2"); // parentId overrides zone match
  });

  it("falls back to master when parentId set but parent not in list", () => {
    const nodes = [
      n({ id: 3, hopCount: 2, zone: "zone-a", parentId: 99 }), // 99 not in list
    ];
    const edges = inferEdges(nodes, true);
    const h2edge = edges.find((e) => e.target === "3");
    expect(h2edge?.source).toBe("master");
  });

  it("falls back to heuristic when parentId absent", () => {
    // No parentId — existing hop+zone heuristic applies
    const nodes = [
      n({ id: 1, hopCount: 1, zone: "entrance" }),
      n({ id: 3, hopCount: 2, zone: "entrance" }),
    ];
    const edges = inferEdges(nodes, true);
    const h2edge = edges.find((e) => e.target === "3");
    expect(h2edge?.source).toBe("1");
  });
});

describe("buildFlowNodes", () => {
  it("always includes a master node", () => {
    const nodes = buildFlowNodes([], true);
    expect(nodes.some((n) => n.id === "master")).toBe(true);
  });

  it("master data.online reflects masterOnline arg", () => {
    const nodes = buildFlowNodes([], false);
    const master = nodes.find((n) => n.id === "master")!;
    expect(master.data.online).toBe(false);
  });

  it("creates one flow node per mesh node plus master", () => {
    const meshNodes = [n({ id: 1, hopCount: 1 }), n({ id: 2, hopCount: 2 })];
    expect(buildFlowNodes(meshNodes, true)).toHaveLength(3);
  });
});
