import type { ActionFunctionArgs } from "react-router";
import { rejectEnrollment } from "../services/orchestrator.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as { mac: string };
  try {
    await rejectEnrollment(body.mac);
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
