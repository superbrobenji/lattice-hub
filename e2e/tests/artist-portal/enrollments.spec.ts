import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { PORTAL_URL } from '../../helpers/urls';

// The approve SlidePanel is the app's only SlidePanel; its root class combo
// `fixed right-0 top-0 ... w-80` (default width) is a reliable scope.
const APPROVE_PANEL = 'div.fixed.right-0.top-0.w-80';

const MAC = 'aa:bb:cc:dd:ee:96';
const REJECT_MAC = 'aa:bb:cc:dd:ee:95';

test.beforeAll(async () => {
  await resetStack();
});

test('approve with name, zone, and type via slide panel', async ({ page, sim, orch }) => {
  await sim.spawnNode(MAC, 'led');
  await expect.poll(async () => (await orch.pending()).some((e) => e.mac === MAC)).toBe(true);

  await page.goto(PORTAL_URL + '/enrollments');
  await expect(page.getByText('1 pending')).toBeVisible();
  const row = page.locator('tr', { hasText: MAC });
  await row.getByRole('button', { name: 'Approve' }).click();

  const panel = page.locator(APPROVE_PANEL);
  await expect(panel.getByText(`Approve: ${MAC}`)).toBeVisible();
  await panel.getByPlaceholder('e.g. entrance-left').fill('Gallery-LED');
  // The Zone/Type <label>s carry no htmlFor association, so getByLabel cannot
  // resolve them; Zone is positionally the first select, Type the second.
  // Option values are zone ids (lowercase slugs).
  await panel.locator('select').first().selectOption('lounge');
  await panel.locator('select').nth(1).selectOption('led');
  await panel.getByRole('button', { name: 'Approve' }).click();

  // Sim node receives JOIN_ACK and joins the mesh.
  await expect.poll(async () => (await sim.node(MAC))?.enrolled).toBe(true);
  // The orchestrator API never surfaces MAC on registered nodes — identify
  // the approved node by the name set in the panel.
  await expect
    .poll(async () => (await orch.nodeByName('Gallery-LED'))?.online, { timeout: 30_000 })
    .toBe(true);
  const approved = await orch.nodeByName('Gallery-LED');
  expect(approved?.zone).toBe('lounge');
  expect(approved?.type).toBe('led');
});

test('reject via two-step confirm', async ({ page, sim, orch }) => {
  await sim.spawnNode(REJECT_MAC, 'pir');
  await expect
    .poll(async () => (await orch.pending()).some((e) => e.mac === REJECT_MAC))
    .toBe(true);

  await page.goto(PORTAL_URL + '/enrollments');
  const row = page.locator('tr', { hasText: REJECT_MAC });
  await row.getByRole('button', { name: 'Reject' }).click();
  await row.getByRole('button', { name: 'Confirm' }).click();

  await expect.poll(async () => (await sim.node(REJECT_MAC))?.rejected).toBe(true);
  await expect
    .poll(async () => (await orch.pending()).some((e) => e.mac === REJECT_MAC))
    .toBe(false);

  // The "All" tab shows the rejected status badge.
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(page.locator('tr', { hasText: REJECT_MAC }).getByText('rejected')).toBeVisible();
});
