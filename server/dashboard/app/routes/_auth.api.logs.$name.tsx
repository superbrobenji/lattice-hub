import type { Route } from "./+types/_auth.api.logs.$name";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const tail = parseInt(url.searchParams.get("tail") ?? "100", 10);
  const logs = await sidecar.getLogs(params.name, tail);
  return new Response(logs, { headers: { "Content-Type": "text/plain" } });
}
