import { Handle, Position } from "@xyflow/react";
import type { NodeProps, Node as FlowNode } from "@xyflow/react";
import type { MeshNodeData } from "../../lib/topology";

export type MeshFlowNode = FlowNode<MeshNodeData, "meshNode">;

const bgColor = (data: MeshNodeData) => {
  if (data.isMaster) return "#14b8a6";
  return data.online ? "#22c55e" : "#ef4444";
};

export function NodeMapNode({ data }: NodeProps<MeshFlowNode>) {
  return (
    <div
      className="px-3 py-2 rounded-lg border border-white/20 text-xs font-medium text-white text-center min-w-[110px] cursor-pointer select-none shadow-md"
      style={{ backgroundColor: bgColor(data) }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "rgba(255,255,255,0.4)", border: "none" }} />
      <div className="truncate max-w-[110px]">{data.label}</div>
      {!data.isMaster && (
        <div className="text-white/70 text-[10px] mt-0.5">
          {data.online ? "online" : "offline"}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} style={{ background: "rgba(255,255,255,0.4)", border: "none" }} />
    </div>
  );
}
