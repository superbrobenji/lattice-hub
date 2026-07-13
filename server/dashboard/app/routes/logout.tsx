import { redirect } from "react-router";
import { clearSessionCookie } from "~/services/auth.server";

export async function action() {
  return redirect("/login", {
    headers: { "Set-Cookie": clearSessionCookie() },
  });
}

export async function loader() {
  return redirect("/login");
}
