import type { Route } from "./+types/_auth.api.stats.$name";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAuth(request);
  const stats = await sidecar.getStats(params.name);
  return stats;
}
