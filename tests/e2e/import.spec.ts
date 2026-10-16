import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { AUTH_FILE, deleteMission, uniqueSuffix } from './helpers';

test.use({ storageState: AUTH_FILE });

test('import a QGroundControl .plan from the dashboard', async ({ page, baseURL }) => {
  const plan = JSON.parse(readFileSync('tests/unit/golden/mission.plan', 'utf8')) as { mission: { items: unknown[] } };
  const fileName = `e2e-import-${uniqueSuffix()}.plan`;
  const before = new Set(
    ((await (await page.request.get('/api/missions')).json()) as { missions: { id: string }[] }).missions.map((m) => m.id)
  );

  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: /^Missions/ })).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(plan)),
  });
  await expect(page.getByText(/^Imported “/).first()).toBeVisible();

  const after = ((await (await page.request.get('/api/missions')).json()) as { missions: { id: string; waypointCount: number }[] })
    .missions;
  const imported = after.filter((m) => !before.has(m.id));
  expect(imported).toHaveLength(1);
  expect(imported[0].waypointCount).toBeGreaterThan(0);

  // Open it from the toast and check the items arrived in the editor.
  await page.getByRole('button', { name: 'Open' }).first().click();
  await page.waitForURL(new RegExp(`/missions/${imported[0].id}$`));
  await expect(page.getByRole('list', { name: 'Mission items' }).getByRole('listitem').first()).toBeVisible({ timeout: 30_000 });

  await deleteMission(page, baseURL!, imported[0].id);
});
