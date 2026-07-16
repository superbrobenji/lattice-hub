import type { ActionFunctionArgs } from "react-router";
import { updateZone } from "../services/orchestrator.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as { id: string; name: string };
  try {
    await updateZone(body.id, body.name);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
