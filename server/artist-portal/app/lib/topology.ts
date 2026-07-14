import dagre from "@dagrejs/dagre";
import type { Node as FlowNode, Edge } from "@xyflow/react";
import type { Node } from "../types/nodes";

export interface MeshNodeData extends Record<string, unknown> {
  label: string;
  online: boolean;
  isMaster: boolean;
  node: Node | null;
}

export function buildFlowNodes(nodes: Node[], masterOnline: boolean): Array<FlowNode<MeshNodeData>> {
  const result: Array<FlowNode<MeshNodeData>> = [
    {
      id: "master",
      type: "meshNode",
      position: { x: 0, y: 0 },
      data: { label: "Master", online: masterOnline, isMaster: true, node: null },
    },
  ];
  for (const node of nodes) {
    result.push({
      id: String(node.id),
      type: "meshNode",
      position: { x: 0, y: 0 },
      data: {
        label: node.name !== "" ? node.name : `Node ${node.id}`,
        online: node.online,
        isMaster: false,
        node,
      },
    });
  }
  return result;
}

export function inferEdges(nodes: Node[], masterOnline: boolean): Edge[] {
  const edges: Edge[] = [];
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  for (const node of nodes) {
    let sourceId: string;

    if (node.parentId !== undefined) {
      // Exact route from firmware route report
      if (nodeById.has(node.parentId)) {
        sourceId = String(node.parentId);
      } else {
        sourceId = "master"; // parent offline or not yet assigned
      }
    } else if (node.hopCount === 1) {
      sourceId = "master";
    } else {
      // Heuristic: same-zone hopCount-1 parent, fallback to first alphabetical
      const parents = nodes
        .filter((p) => p.hopCount === node.hopCount - 1)
        .sort((a, b) => a.name.localeCompare(b.name));
      const sameZone = parents.filter((p) => p.zone === node.zone);
      const parent = sameZone[0] ?? parents[0];
      if (!parent) continue;
      sourceId = String(parent.id);
    }

    const source = sourceId === "master" ? null : nodeById.get(parseInt(sourceId, 10));
    const connected =
      sourceId === "master"
        ? masterOnline && node.online
        : (source?.online ?? false) && node.online;

    edges.push({
      id: `${sourceId}-${node.id}`,
      source: sourceId,
      target: String(node.id),
      style: { stroke: connected ? "#ffffff" : "#ef4444", strokeWidth: 1.5 },
    });
  }

  return edges;
}

const NODE_WIDTH = 130;
const NODE_HEIGHT = 60;

export function applyDagreLayout(nodes: FlowNode[], edges: Edge[]): FlowNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 100 });

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    if (!pos) return node;
    return { ...node, position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 } };
  });
}
