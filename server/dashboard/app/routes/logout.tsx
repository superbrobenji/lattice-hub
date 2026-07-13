import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { clearSessionCookie } from "~/services/auth.server";

export async function action(_: Route.ActionArgs) {
  return redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function loader() {
  return redirect("/login");
}
