import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // Serial on purpose — do not raise `workers` or flip `fullyParallel`
  // without restructuring the suite. Every spec file force-recreates the
  // orchestrator + mesh-sim containers in beforeAll (helpers/stack.ts
  // resetStack), and mesh-sim is one global instance with fixed MACs
  // (helpers/urls.ts), so a second worker would have the stack yanked out
  // from under it mid-test and the enrollment specs would 409 on duplicate
  // spawns. Test bodies total ~15s; the wall-clock is the per-file reset plus
  // the health-timeout transitions, neither of which parallel workers can
  // overlap — those are tuned in server/docker-compose.stub.yml instead.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
