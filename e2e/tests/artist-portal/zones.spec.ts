import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { PORTAL_URL } from '../../helpers/urls';

// ZoneCard root <div> class combo (shared with NodeCard, but only ZoneCards
// render on /zones, so class + name text is an unambiguous card scope).
const CARD = 'div.bg-surface.border.border-border.rounded-lg.p-4';

test.beforeAll(async () => {
  await resetStack();
});

test('create, rename, and delete a zone', async ({ page }) => {
  await page.goto(PORTAL_URL + '/zones');
  await expect(page.getByRole('heading', { name: 'Zones' })).toBeVisible();

  // Create
  await page.getByPlaceholder('New zone name').fill('Studio');
  await page.getByRole('button', { name: 'Create' }).click();
  const card = page.locator(CARD, { hasText: 'Studio' });
  await expect(card).toBeVisible();
  await expect(card.getByText('0 nodes')).toBeVisible();

  // Rename via InlineEdit: button showing value -> click -> input -> Enter.
  // While editing, the card's name lives in the input's value (not text
  // content), so the hasText-scoped `card` no longer matches — target the
  // autofocused edit input instead.
  await card.getByRole('button', { name: 'Studio' }).click();
  const editInput = page.locator(CARD).locator('input:focus');
  await editInput.fill('Studio-2');
  await editInput.press('Enter');
  const renamed = page.locator(CARD, { hasText: 'Studio-2' });
  await expect(renamed).toBeVisible();

  // Delete (zone has no nodes, so the delete button is enabled).
  await renamed.getByTitle('Delete zone').click();
  await expect(renamed.getByText('Delete zone "Studio-2"?')).toBeVisible();
  await renamed.getByRole('button', { name: 'Confirm' }).click();
  // "Studio-2" briefly matches both the card name and the confirm prompt, so
  // assert via count (same meaning as not-visible, strict-mode safe).
  await expect(page.getByText('Studio-2')).toHaveCount(0);
});

test('zone with nodes cannot be deleted', async ({ page }) => {
  await page.goto(PORTAL_URL + '/zones');
  // The Entrance zone contains the seeded Entrance-PIR node.
  const entrance = page.locator(CARD, { hasText: 'Entrance' });
  await expect(entrance.getByText('1 node', { exact: true })).toBeVisible();
  await expect(entrance.getByTitle('Move nodes to another zone first')).toBeDisabled();
});
