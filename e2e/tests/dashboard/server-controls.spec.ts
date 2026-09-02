import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import { DASHBOARD_URL } from '../../helpers/urls';

test.beforeAll(async () => {
  await resetStack();
});

test('status shows master online with node counts', async ({ dashPage, orch }) => {
  await expect
    .poll(async () => (await orch.status()).nodes.online, { timeout: 30_000 })
    .toBeGreaterThanOrEqual(3);
  await dashPage.goto(DASHBOARD_URL + '/server');
  await expect(dashPage.getByText('Master online')).toBeVisible();
  await expect(dashPage.getByText('Online', { exact: true })).toBeVisible();
});

test('stop and start the mesh process', async ({ dashPage }) => {
  // server/orchestrator/mesh/server.go: Stop() clears both links'
  // last-frame times, so "Master online" flips to Offline on the next
  // reload rather than lingering for the 75s healthTimeout. The generous
  // timeouts below are kept as headroom for the stub stack's process
  // control round-trips, not for a health-timeout transition.
  test.setTimeout(180_000);

  await dashPage.goto(DASHBOARD_URL + '/server');
  await dashPage.getByRole('button', { name: 'Stop' }).click();

  // The /server route has no live polling (unlike Overview's usePolling),
  // so reload on each poll tick to observe the transition.
  await expect
    .poll(
      async () => {
        await dashPage.reload();
        return dashPage.getByText('Offline', { exact: true }).isVisible();
      },
      { timeout: 120_000 },
    )
    .toBe(true);

  await dashPage.getByRole('button', { name: 'Start' }).click();
  // Start() re-opens the transport and stamps a fresh frame timestamp
  // synchronously, so this flips back quickly — but the sim reconnect
  // (tcp:// retry loop) can add latency, so give it real headroom too.
  await expect
    .poll(
      async () => {
        await dashPage.reload();
        return dashPage.getByText('Online', { exact: true }).isVisible();
      },
      { timeout: 60_000 },
    )
    .toBe(true);
});
