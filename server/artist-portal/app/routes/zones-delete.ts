import type { ActionFunctionArgs } from "react-router";
import { deleteZone } from "../services/orchestrator.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as { id: string };
  try {
    await deleteZone(body.id);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
