import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { PORTAL_URL, ENTRANCE_MAC, ENTRANCE_NAME, KITCHEN_NAME } from '../../helpers/urls';

test.beforeAll(async () => {
  await resetStack();
});

test('shows connected banner and seeded nodes with live state', async ({ page }) => {
  await page.goto(PORTAL_URL + '/');
  await expect(page.getByText('Connected to mesh')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(ENTRANCE_NAME)).toBeVisible();
  await expect(page.getByText(KITCHEN_NAME)).toBeVisible();

  // NodeCard root divs share a class combo with ZoneCard, but only NodeCard
  // is rendered on this page, so scoping by that class + the node name is safe.
  const entranceCard = page.locator('div.bg-surface.border.border-border.rounded-lg.p-4', {
    hasText: ENTRANCE_NAME,
  });
  await expect(entranceCard.locator('.bg-ok').first()).toBeVisible({ timeout: 30_000 });

  // Kitchen is seeded silent -> never heartbeats -> offline (danger dot).
  const kitchenCard = page.locator('div.bg-surface.border.border-border.rounded-lg.p-4', {
    hasText: KITCHEN_NAME,
  });
  await expect(kitchenCard.locator('.bg-danger').first()).toBeVisible({ timeout: 30_000 });
});

test('motion event appears in the live event feed', async ({ page, sim }) => {
  await page.goto(PORTAL_URL + '/');
  await expect(page.getByText('Connected to mesh')).toBeVisible({ timeout: 30_000 });
  await sim.motion(ENTRANCE_MAC);
  await expect(page.getByText('motion').first()).toBeVisible({ timeout: 15_000 });
});
