import { getNodes } from "../services/orchestrator.server";

export async function loader() {
  const nodes = await getNodes();
  return Response.json({ nodes });
}
