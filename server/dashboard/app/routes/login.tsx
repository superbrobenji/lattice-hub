import { redirect, data } from "react-router";
import type { Route } from "./+types/login";
import { getSession, validateKey, setSessionCookie } from "~/services/auth.server";

export async function loader({ request }: Route.LoaderArgs) {
  const session = getSession(request);
  if (session && validateKey(session)) throw redirect("/");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const key = String(form.get("key") ?? "");

  if (!validateKey(key)) {
    return data({ error: "Invalid admin key" }, { status: 401 });
  }

  return redirect("/", {
    headers: { "Set-Cookie": setSessionCookie(key) },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  return (
    <div className="min-h-screen bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-border rounded-xl p-8 space-y-6">
          <div>
            <h1 className="text-xl font-semibold text-text">Lattice Hub</h1>
            <p className="text-sm text-muted mt-1">Enter your admin key to continue</p>
          </div>

          <form method="post" className="space-y-4">
            <div>
              <label htmlFor="key" className="block text-xs text-muted mb-1.5">
                Admin Key
              </label>
              <input
                id="key"
                name="key"
                type="password"
                autoFocus
                className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="••••••••"
              />
            </div>

            {actionData?.error && (
              <p className="text-xs text-danger">{actionData.error}</p>
            )}

            <button
              type="submit"
              className="w-full bg-accent hover:bg-accent-hover text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              Sign in
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
