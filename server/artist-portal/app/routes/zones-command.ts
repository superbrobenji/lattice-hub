import type { ActionFunctionArgs } from "react-router";
import { sendZoneCommand } from "../services/orchestrator.server";

export async function action({ request }: ActionFunctionArgs) {
  const body = (await request.json()) as {
    id: string;
    action: string;
    colour?: number[];
  };
  try {
    const data = await sendZoneCommand(body.id, {
      action: body.action,
      colour: body.colour,
    });
    return Response.json(data, { status: 202 });
  } catch (e) {
    return Response.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
