import type { Route } from "../+types/root";
import type { INode, INodes } from "~/interfaces/INodes";
import { apiService } from "~/services/apiService";
import NodeCard from "~/components/NodeCard/nodeCard";

export async function loader(): Promise<INodes> {
  return apiService.getNodes();
}

export default function Nodes({ loaderData }: Route.ComponentProps) {
  const nodes = loaderData as INodes | undefined;
  return (
    <div className="p-6 justify-center">
      <h1 className="text-center">Nodes</h1>
      <br />
      <div className="nodes-container w-[80%] grid grid-cols-3 gap-4 justify-center m-auto">
        {nodes?.map((node: INode) => (
          <NodeCard key={node.id} nodeData={node} />
        ))}
      </div>
    </div>
  );
}
