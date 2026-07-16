import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { DASHBOARD_URL } from '../../helpers/urls';

test.beforeAll(async () => {
  await resetStack();
});

test('rejects a wrong admin key', async ({ page }) => {
  await page.goto(DASHBOARD_URL + '/login');
  await page.getByLabel('Admin Key').fill('wrong');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Invalid admin key')).toBeVisible();
});

test('logs in with the stub admin key and out again', async ({ page }) => {
  await page.goto(DASHBOARD_URL + '/login');
  await page.getByLabel('Admin Key').fill('dev');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(DASHBOARD_URL + '/');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated visit redirects to login', async ({ page }) => {
  await page.goto(DASHBOARD_URL + '/nodes');
  await expect(page).toHaveURL(/\/login/);
});
