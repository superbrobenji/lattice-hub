import { useEffect, useState, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { Node } from "../../types/nodes";
import { buildFlowNodes, inferEdges, applyDagreLayout, type MeshNodeData } from "../../lib/topology";
import { NodeMapNode, type MeshFlowNode } from "./NodeMapNode";
import { NodeDetailPanel } from "./NodeDetailPanel";

const NODE_TYPES = { meshNode: NodeMapNode };

interface Props {
  nodes: Node[];
  serverOnline: boolean;
}

export function NodeMap({ nodes, serverOnline }: Props) {
  const [mounted, setMounted] = useState(false);
  const [rfNodes, setRfNodes, onNodesChange] = useNodesState<MeshFlowNode>([]);
  const [rfEdges, setRfEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);

  const selectedNode = selectedNodeId !== null
    ? nodes.find((n) => n.id === selectedNodeId) ?? null
    : null;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const flowNodes = buildFlowNodes(nodes, serverOnline);
    const edges = inferEdges(nodes, serverOnline);
    const positioned = applyDagreLayout(flowNodes, edges);
    setRfNodes(positioned as MeshFlowNode[]);
    setRfEdges(edges);
  }, [nodes, serverOnline, mounted, setRfNodes, setRfEdges]);

  useEffect(() => {
    if (selectedNodeId !== null && !nodes.find((n) => n.id === selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [nodes, selectedNodeId]);

  const onNodeClick: NodeMouseHandler = useCallback((_evt, node) => {
    if ((node.data as MeshNodeData).isMaster) return;
    setSelectedNodeId((node.data as MeshNodeData).node?.id ?? null);
  }, []);

  const handlePanelClose = useCallback(() => setSelectedNodeId(null), []);

  if (!mounted) {
    return (
      <div className="h-[600px] bg-surface rounded-lg border border-border animate-pulse" />
    );
  }

  return (
    <div className="relative h-[600px] bg-surface rounded-lg border border-border overflow-hidden">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={NODE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        colorMode="dark"
      >
        <Background color="#2a3030" gap={20} />
        <Controls
          style={{ background: "#1e2424", border: "1px solid #2a3030", borderRadius: 8 }}
        />
      </ReactFlow>

      {selectedNode && (
        <NodeDetailPanel node={selectedNode} onClose={handlePanelClose} />
      )}
    </div>
  );
}
