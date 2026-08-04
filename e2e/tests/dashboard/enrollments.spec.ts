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

  // Approve opens a modal dialog collecting a required name; fill it in and
  // confirm (see _auth.enrollments.tsx — modal-per-row, no slide-panel
  // primitive in the dashboard).
  await expect(dashPage.getByText(`Approve ${NEW_MAC}`)).toBeVisible();
  await dashPage.getByLabel(/^name$/i).fill('test-node-42');
  await dashPage.getByRole('button', { name: 'Confirm' }).click();

  // Plain form POST -> page reload; the row is gone once the enrollment is
  // no longer pending.
  await expect(dashPage.locator('tr', { hasText: NEW_MAC })).toHaveCount(0);

  // Sim node receives JOIN_ACK and joins the mesh
  await expect.poll(async () => (await sim.node(NEW_MAC))?.enrolled).toBe(true);

  // The orchestrator's public API never surfaces MAC on registered nodes
  // (OrchNode has no `mac` field); identify the approved node by the name
  // submitted through the dialog and confirm it comes online.
  await expect.poll(async () => (await orch.nodes()).length, { timeout: 30_000 }).toBe(before + 1);
  await expect
    .poll(async () => (await orch.nodeByName('test-node-42'))?.online, { timeout: 30_000 })
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
