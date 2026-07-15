import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { DASHBOARD_URL } from '../../helpers/urls';

const NEW_MAC = 'aa:bb:cc:dd:ee:99';
const REJECT_MAC = 'aa:bb:cc:dd:ee:98';

test.beforeAll(async () => {
  await resetStack();
});

test('spawned node appears pending and can be approved', async ({ dashPage, sim, orch }) => {
  const before = (await orch.nodes()).length;

  await sim.spawnNode(NEW_MAC, 'led');
  await expect
    .poll(async () => (await orch.pending()).some((e) => e.mac === NEW_MAC))
    .toBe(true);

  await dashPage.goto(DASHBOARD_URL + '/enrollments');
  const row = dashPage.locator('tr', { hasText: NEW_MAC });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Approve' }).click();

  // Plain form POST -> page reload; the row is gone once the enrollment is
  // no longer pending.
  await expect(dashPage.locator('tr', { hasText: NEW_MAC })).toHaveCount(0);

  // Sim node receives JOIN_ACK and joins the mesh
  await expect.poll(async () => (await sim.node(NEW_MAC))?.enrolled).toBe(true);

  // The orchestrator's public API never surfaces MAC on registered nodes
  // (OrchNode has no `mac` field), and the dashboard's plain Approve button
  // posts no `name` (see _auth.enrollments.tsx), so the newly-registered node
  // lands in the registry with an empty name. Identify it by the node-count
  // increase, then confirm the empty-named entry is the one that comes
  // online (heartbeats into the registry).
  await expect.poll(async () => (await orch.nodes()).length, { timeout: 30_000 }).toBe(before + 1);
  await expect
    .poll(
      async () => {
        const nodes = await orch.nodes();
        return nodes.find((n) => n.name === '')?.online;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
});

test('rejecting an enrollment stops the node joining', async ({ dashPage, sim, orch }) => {
  const before = (await orch.nodes()).length;

  await sim.spawnNode(REJECT_MAC, 'pir');
  await expect
    .poll(async () => (await orch.pending()).some((e) => e.mac === REJECT_MAC))
    .toBe(true);

  await dashPage.goto(DASHBOARD_URL + '/enrollments');
  const row = dashPage.locator('tr', { hasText: REJECT_MAC });
  await row.getByRole('button', { name: 'Reject' }).click();

  await expect.poll(async () => (await sim.node(REJECT_MAC))?.rejected).toBe(true);
  await expect
    .poll(async () => (await orch.pending()).some((e) => e.mac === REJECT_MAC))
    .toBe(false);
  // A rejected enrollment is never assigned into the node registry.
  expect((await orch.nodes()).length).toBe(before);
});
