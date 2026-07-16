// Commands proxy through same-origin server resource routes
// (nodes-command.ts / zones-command.ts) rather than hitting the
// orchestrator directly from the browser, so the API key never reaches
// the client (see server/artist-portal/app/services/orchestrator.server.ts).

export async function sendNodeCommand(
  id: number,
  action: string,
  colour?: number[],
): Promise<{ success: boolean; data?: { commandId: string }; error?: string }> {
  const res = await fetch("/nodes-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, colour }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Command failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function sendZoneCommand(
  id: string,
  action: string,
  colour?: number[],
): Promise<{ success: boolean; data?: { sent: number }; error?: string }> {
  const res = await fetch("/zones-command", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, action, colour }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zone command failed: ${res.status} ${text}`);
  }
  return res.json();
}
