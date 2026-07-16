import type { ActionFunctionArgs } from "react-router";
import { updateNode } from "../services/orchestrator.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as {
    id: number;
    name?: string;
    zone?: string;
    type?: string;
  };
  try {
    await updateNode(body.id, {
      name: body.name,
      zone: body.zone,
      type: body.type,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
