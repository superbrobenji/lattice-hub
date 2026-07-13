import { redirect } from "react-router";
import type { Route } from "./+types/_auth.infrastructure.$name.restart";
import { requireAuth } from "~/services/auth.server";
import { sidecar } from "~/services/sidecar.server";

export async function action({ request, params }: Route.ActionArgs) {
  await requireAuth(request);
  await sidecar.restartContainer(params.name);
  return redirect(`/infrastructure/${params.name}`);
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return redirect("/infrastructure");
}
