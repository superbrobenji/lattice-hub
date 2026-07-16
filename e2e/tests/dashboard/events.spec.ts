import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { DASHBOARD_URL, ENTRANCE_MAC } from '../../helpers/urls';

test.beforeAll(async () => {
  await resetStack();
});

test('motion event lands in the Kafka events page', async ({ dashPage, sim }) => {
  await sim.motion(ENTRANCE_MAC);
  await expect
    .poll(
      async () => {
        await dashPage.goto(DASHBOARD_URL + '/events');
        return dashPage.getByText('motion', { exact: false }).count();
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
});
