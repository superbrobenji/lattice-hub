import { execSync } from 'node:child_process';
import path from 'node:path';

const repoRoot = path.resolve(__dirname, '..', '..');
const COMPOSE =
  'docker compose -f server/docker-compose.yml -f server/docker-compose.stub.yml -f server/docker-compose.stub.seed.yml';
const env = { ...process.env, API_KEY: 'dev', ADMIN_KEY: 'dev' };

async function waitOk(url: string, init: RequestInit = {}, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown = null;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return;
      lastErr = new Error(`${url} → ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`timed out waiting for ${url}: ${lastErr}`);
}

export async function waitForStack(): Promise<void> {
  await waitOk('http://localhost:8080/health');
  await waitOk('http://localhost:9001/sim/state');
  await waitOk('http://localhost:3000/login');
  await waitOk('http://localhost:3001/');
}

/** Recreate orchestrator + sim: clean registries (tmpfs + ro seed reload). */
export async function resetStack(): Promise<void> {
  execSync(`${COMPOSE} up -d --force-recreate orchestrator mesh-sim`, {
    cwd: repoRoot,
    env,
    stdio: 'inherit',
  });
  await waitForStack();
}
