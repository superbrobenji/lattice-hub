import type { ActionFunctionArgs } from "react-router";
import { approveEnrollment } from "../services/orchestrator.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as {
    mac: string;
    name?: string;
    zone?: string;
    type?: string;
    nodeId?: number;
  };
  try {
    await approveEnrollment(body.mac, {
      name: body.name,
      zone: body.zone,
      type: body.type,
      nodeId: body.nodeId,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
