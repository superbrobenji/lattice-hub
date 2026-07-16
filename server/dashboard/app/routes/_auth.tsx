import { Outlet } from "react-router";
import type { Route } from "./+types/_auth";
import { requireAuth } from "~/services/auth.server";
import { AppLayout } from "~/components/layout/AppLayout";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export default function AuthLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
