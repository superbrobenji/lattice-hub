const BASE = import.meta.env.VITE_PUBLIC_API_URL ?? "http://localhost:8080";

export async function sendNodeCommand(
  id: number,
  action: string,
  colour?: number[],
): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/nodes/${id}/command`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, colour }),
  });
  if (!res.ok) throw new Error("Command failed");
}
