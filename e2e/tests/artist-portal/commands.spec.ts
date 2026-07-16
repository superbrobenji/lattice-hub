import { test, expect } from '../../fixtures';
import { resetStack } from '../../helpers/stack';
import {
  PORTAL_URL,
  HALLWAY_MAC,
  HALLWAY_NAME,
  LOUNGE_MAC,
  LOUNGE_NAME,
} from '../../helpers/urls';

// NodeCard/ZoneCard share this root <div> class combo; only one card kind
// renders per page, so class + name text is an unambiguous scope (same
// pattern as live-tracker.spec.ts / zones.spec.ts from Task 9).
const CARD = 'div.bg-surface.border.border-border.rounded-lg.p-4';

// Commands proxy through same-origin portal resource routes (/nodes-command,
// /zones-command — server/artist-portal/app/routes/*-command.ts), which
// attach the Bearer key server-side and relay the orchestrator's standard
// envelope: nodes → 202 {"success":true,"data":{"commandId":"..."}} and
// zones → 202 {"success":true,"data":{"sent":N}} (both verified live), so
// the commandId lives at `body.data.commandId`, not top-level.
interface CommandEnvelope {
  data: { commandId: string };
}

test.beforeAll(async () => {
  await resetStack();
});

test('LED command from node card gets acked', async ({ page, orch, sim }) => {
  await expect
    .poll(async () => (await orch.nodeByName(HALLWAY_NAME))?.online, { timeout: 30_000 })
    .toBe(true);
  const nodeId = (await orch.nodeByName(HALLWAY_NAME))!.id;

  await page.goto(PORTAL_URL + '/');
  await expect(page.getByText('Connected to mesh')).toBeVisible({ timeout: 30_000 });

  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/nodes-command') && r.request().method() === 'POST',
  );
  const card = page.locator(CARD, { hasText: HALLWAY_NAME });
  await card.getByRole('button', { name: 'On', exact: true }).click();
  const resp = await respPromise;
  expect(resp.status()).toBe(202);
  const { data } = (await resp.json()) as CommandEnvelope;

  await expect
    .poll(async () => (await orch.commandStatus(nodeId, data.commandId)).status)
    .toBe('acked');
  expect((await sim.node(HALLWAY_MAC))?.ackCount).toBeGreaterThan(0);
});

test('relay command gets acked', async ({ page, orch }) => {
  await expect
    .poll(async () => (await orch.nodeByName(LOUNGE_NAME))?.online, { timeout: 30_000 })
    .toBe(true);
  const nodeId = (await orch.nodeByName(LOUNGE_NAME))!.id;

  await page.goto(PORTAL_URL + '/');
  await expect(page.getByText('Connected to mesh')).toBeVisible({ timeout: 30_000 });
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/nodes-command') && r.request().method() === 'POST',
  );
  const card = page.locator(CARD, { hasText: LOUNGE_NAME });
  await card.getByRole('button', { name: 'Relay On' }).click();
  const resp = await respPromise;
  expect(resp.status()).toBe(202);
  const { data } = (await resp.json()) as CommandEnvelope;

  await expect
    .poll(async () => (await orch.commandStatus(nodeId, data.commandId)).status)
    .toBe('acked');
});

test('zone command acks via zone card', async ({ page, sim }) => {
  const before = (await sim.node(HALLWAY_MAC))?.ackCount ?? 0;
  await page.goto(PORTAL_URL + '/zones');
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/zones-command') && r.request().method() === 'POST',
  );
  const zone = page.locator(CARD, { hasText: 'Hallway' });
  await zone.getByRole('button', { name: 'LED On' }).click();
  const resp = await respPromise;
  expect(resp.status()).toBe(202);
  // Zone commands carry no commandId ({"success":true,"data":{"sent":N}} —
  // v1ZoneCommand has no per-command tracking), so assert delivery via the
  // sim's ackCount delta instead.
  const { data } = (await resp.json()) as { data: { sent: number } };
  expect(data.sent).toBeGreaterThan(0);
  await expect
    .poll(async () => (await sim.node(HALLWAY_MAC))?.ackCount)
    .toBeGreaterThan(before);
});

test('command to a powered-off node stays pending', async ({ page, orch, sim }) => {
  const nodeId = (await orch.nodeByName(LOUNGE_NAME))!.id;

  await sim.setOffline(LOUNGE_MAC);
  await page.goto(PORTAL_URL + '/');
  await expect(page.getByText('Connected to mesh')).toBeVisible({ timeout: 30_000 });
  const respPromise = page.waitForResponse(
    (r) => r.url().includes('/nodes-command') && r.request().method() === 'POST',
  );
  const card = page.locator(CARD, { hasText: LOUNGE_NAME });
  await card.getByRole('button', { name: 'Relay On' }).click();
  const resp = await respPromise;
  expect(resp.status()).toBe(202);
  const { data } = (await resp.json()) as CommandEnvelope;

  // Deterministic bound instead of a single fixed sleep: the sim ack loop
  // ticks every 250ms (server/orchestrator/meshsim/sim.go tickInterval), and
  // command_store.go never auto-transitions pending → timeout on its own, so
  // polling 6x/500ms (3s total) and requiring every read to stay 'pending'
  // gives the sim ~12 tick opportunities to (wrongly) ack while still failing
  // fast if it does.
  for (let i = 0; i < 6; i++) {
    expect((await orch.commandStatus(nodeId, data.commandId)).status).toBe('pending');
    await page.waitForTimeout(500);
  }

  await sim.setOnline(LOUNGE_MAC);
});
