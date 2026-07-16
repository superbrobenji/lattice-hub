import { test, expect } from '../fixtures';
import { resetStack } from '../helpers/stack';
import { DASHBOARD_URL, PORTAL_URL, KITCHEN_NAME } from '../helpers/urls';

test.beforeAll(async () => {
  await resetStack();
});

test('stack is healthy and sim nodes come online', async ({ orch, sim }) => {
  const state = await sim.state();
  expect(state.nodes).toHaveLength(4);
  await expect
    .poll(async () => (await orch.nodes()).filter((n) => n.online).length, { timeout: 30_000 })
    .toBe(3); // Kitchen-PIR is silent
  const kitchen = await orch.nodeByName(KITCHEN_NAME);
  expect(kitchen?.online).toBe(false);
});

test('both dashboards serve', async ({ dashPage, page }) => {
  await dashPage.goto(DASHBOARD_URL + '/');
  await expect(dashPage).not.toHaveURL(/\/login/);
  await expect(dashPage.getByRole('link', { name: 'Nodes' })).toBeVisible();
  await page.goto(PORTAL_URL + '/');
  await expect(page.getByText('Lattice', { exact: false }).first()).toBeVisible();
});
