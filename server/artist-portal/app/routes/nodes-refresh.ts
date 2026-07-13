import { getNodes } from "../services/orchestrator.server";
import type { Node } from "../types/nodes";

export async function loader() {
  try {
    const nodes = await getNodes();
    return Response.json({ nodes });
  } catch {
    return Response.json({ nodes: [] as Node[] }, { status: 500 });
  }
}
