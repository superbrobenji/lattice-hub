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
        // Assert on the triggered node's MAC, which only appears inside a
        // rendered event's JSON value — not 'motion', which also matches the
        // static page header ("Kafka topic: motion-trigger") and so passed
        // even when the page rendered zero events.
        return dashPage.getByText(ENTRANCE_MAC, { exact: false }).count();
      },
      { timeout: 30_000 },
    )
    .toBeGreaterThan(0);
});
