import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import {
  DASHBOARD_URL,
  ENTRANCE_NAME,
  HALLWAY_NAME,
  KITCHEN_NAME,
  LOUNGE_NAME,
  LOUNGE_MAC,
} from '../../helpers/urls';

test.beforeAll(async () => {
  await resetStack();
});

test('lists all seeded nodes', async ({ dashPage }) => {
  await dashPage.goto(DASHBOARD_URL + '/nodes');
  for (const name of [ENTRANCE_NAME, HALLWAY_NAME, KITCHEN_NAME, LOUNGE_NAME]) {
    await expect(dashPage.getByText(name)).toBeVisible();
  }
  await expect(dashPage.getByText('4 nodes registered')).toBeVisible();
});

test('node detail shows online after sim heartbeat', async ({ dashPage, orch }) => {
  await expect
    .poll(async () => (await orch.nodeByName(ENTRANCE_NAME))?.online, { timeout: 30_000 })
    .toBe(true);
  const node = await orch.nodeByName(ENTRANCE_NAME);
  await dashPage.goto(`${DASHBOARD_URL}/nodes/${node!.id}`);
  // Name renders twice (breadcrumb + PageHeader h1) — scope to the heading.
  await expect(dashPage.getByRole('heading', { name: ENTRANCE_NAME })).toBeVisible();
  await expect(dashPage.getByText('Yes', { exact: true })).toBeVisible(); // Online row
});

test('silent node shows offline', async ({ dashPage, orch }) => {
  const node = await orch.nodeByName(KITCHEN_NAME);
  await dashPage.goto(`${DASHBOARD_URL}/nodes/${node!.id}`);
  await expect(dashPage.getByRole('heading', { name: KITCHEN_NAME })).toBeVisible();
  await expect(dashPage.getByText('No', { exact: true })).toBeVisible();
});

test('node goes offline when sim node powers off', async ({ dashPage, sim, orch }) => {
  // healthTimeout is hard-coded to 75s server-side — the poll below (and the
  // whole test) needs headroom past the suite-wide 90s default test timeout.
  test.setTimeout(180_000);

  await sim.setOffline(LOUNGE_MAC);
  // healthTimeout is 75s — poll the API, not the UI, then confirm UI once flipped
  await expect
    .poll(async () => (await orch.nodeByName(LOUNGE_NAME))?.online, { timeout: 120_000 })
    .toBe(false);
  const node = await orch.nodeByName(LOUNGE_NAME);
  await dashPage.goto(`${DASHBOARD_URL}/nodes/${node!.id}`);
  await expect(dashPage.getByText('No', { exact: true })).toBeVisible();
  await sim.setOnline(LOUNGE_MAC);
});
