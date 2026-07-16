import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { PORTAL_URL, HALLWAY_NAME, KITCHEN_NAME } from '../../helpers/urls';

// NodeDetailPanel renders a plain <div> (not SlidePanel, no role="dialog");
// its root class combo `absolute right-0 top-0 ... w-72` is unique in the app
// (w-72 appears nowhere else), so this is the reliable scoping locator.
const NODE_PANEL = 'div.absolute.right-0.top-0.w-72';

const DISPOSABLE_MAC = 'aa:bb:cc:dd:ee:97';

test.beforeAll(async () => {
  await resetStack();
});

test('renders route-report topology', async ({ page, orch }) => {
  // Wait until firmware route reports have landed: Hallway-LED routes via
  // Entrance-PIR, which the orchestrator surfaces as parentId (the public
  // API exposes parentId, never routePath — see helpers/orchestrator.ts).
  await expect
    .poll(async () => (await orch.nodeByName(HALLWAY_NAME))?.parentId, { timeout: 30_000 })
    .toBeDefined();

  await page.goto(PORTAL_URL + '/');
  await page.getByRole('button', { name: 'Mesh Map' }).click();
  // 4 seeded nodes + master
  await expect(page.locator('.react-flow__node')).toHaveCount(5, { timeout: 30_000 });
  await expect(page.locator('.react-flow__edge')).toHaveCount(4);

  const hallway = page.locator('.react-flow__node', { hasText: HALLWAY_NAME });
  await expect(hallway.getByText('online', { exact: true })).toBeVisible();
  const kitchen = page.locator('.react-flow__node', { hasText: KITCHEN_NAME });
  await expect(kitchen.getByText('offline', { exact: true })).toBeVisible();
});

test('node panel: rename, re-zone, and delete', async ({ page, sim, orch }) => {
  // Work on a disposable spawned+approved node so seed state stays intact.
  await sim.spawnNode(DISPOSABLE_MAC, 'led');
  await expect
    .poll(async () => (await orch.pending()).some((e) => e.mac === DISPOSABLE_MAC))
    .toBe(true);

  // Approve via the portal enrollments page, setting a name so the node is
  // identifiable through the orchestrator API (which never surfaces MAC on
  // registered nodes).
  await page.goto(PORTAL_URL + '/enrollments');
  const row = page.locator('tr', { hasText: DISPOSABLE_MAC });
  await row.getByRole('button', { name: 'Approve' }).click();
  const approvePanel = page.locator('div.fixed.right-0.top-0.w-80');
  await expect(approvePanel.getByText(`Approve: ${DISPOSABLE_MAC}`)).toBeVisible();
  await approvePanel.getByPlaceholder('e.g. entrance-left').fill('Disposable-LED');
  await approvePanel.getByRole('button', { name: 'Approve' }).click();
  await expect
    .poll(async () => (await orch.nodeByName('Disposable-LED'))?.online, { timeout: 30_000 })
    .toBe(true);

  await page.goto(PORTAL_URL + '/');
  await page.getByRole('button', { name: 'Mesh Map' }).click();
  await page.locator('.react-flow__node', { hasText: 'Disposable-LED' }).click();

  const panel = page.locator(NODE_PANEL);
  await expect(panel.getByRole('heading', { name: 'Disposable-LED' })).toBeVisible();

  // Rename via InlineEdit: button showing value -> click -> input -> Enter.
  await panel.getByRole('button', { name: 'Disposable-LED' }).click();
  await panel.locator('input').first().fill('Studio-LED');
  await panel.locator('input').first().press('Enter');
  await expect
    .poll(async () => (await orch.nodeByName('Studio-LED'))?.name)
    .toBe('Studio-LED');

  // Re-zone. The Zone <label> has no htmlFor association, so getByLabel
  // cannot work; the Zone select is positionally the first select in the
  // panel (Type is the second). Option values are zone ids (lowercase).
  await panel.locator('select').first().selectOption('lounge');
  await expect
    .poll(async () => (await orch.nodeByName('Studio-LED'))?.zone)
    .toBe('lounge');

  // Delete: trash icon -> "Delete this node?" -> Confirm (scoped to panel).
  await panel.getByLabel('Delete node').click();
  await expect(panel.getByText('Delete this node?')).toBeVisible();
  await panel.getByRole('button', { name: 'Confirm' }).click();
  await expect
    .poll(async () => (await orch.nodeByName('Studio-LED')) === undefined)
    .toBe(true);
});
