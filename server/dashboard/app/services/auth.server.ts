import { redirect } from "react-router";

const COOKIE_NAME = "lattice_session";
const ADMIN_KEY = process.env.ADMIN_KEY ?? "";

function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), v.join("=").trim()];
    })
  );
}

export function getSession(request: Request): string | null {
  const cookieHeader = request.headers.get("Cookie") ?? "";
  const cookies = parseCookies(cookieHeader);
  return cookies[COOKIE_NAME] ?? null;
}

export async function requireAuth(request: Request): Promise<string> {
  const session = getSession(request);
  if (!session || session !== ADMIN_KEY) {
    throw redirect("/login");
  }
  return session;
}

export function setSessionCookie(key: string): string {
  return `${COOKIE_NAME}=${key}; HttpOnly; SameSite=Lax; Path=/`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

export function validateKey(key: string): boolean {
  return key.length > 0 && key === ADMIN_KEY;
}
