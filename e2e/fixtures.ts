import { test as base, type Page } from '@playwright/test';
import { SimClient } from './helpers/sim';
import { OrchClient } from './helpers/orchestrator';

interface Fixtures {
  sim: SimClient;
  orch: OrchClient;
  dashPage: Page;
}

export const test = base.extend<Fixtures>({
  sim: async ({}, use) => use(new SimClient()),
  orch: async ({}, use) => use(new OrchClient()),
  dashPage: async ({ browser }, use) => {
    const ctx = await browser.newContext();
    await ctx.addCookies([
      { name: 'lattice_session', value: 'dev', domain: 'localhost', path: '/' },
    ]);
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from '@playwright/test';
