import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  AUTH_FILE,
  clickMap,
  createMission,
  deleteMission,
  expectSaved,
  mapTool,
  missionItems,
  openEditor,
  uniqueSuffix,
  type CreatedMission,
} from './helpers';

test.use({ storageState: AUTH_FILE });

let mission: CreatedMission;

test.beforeEach(async ({ page, baseURL }, info) => {
  mission = await createMission(page, baseURL!, `E2E ${info.title.slice(0, 40)} ${uniqueSuffix()}`);
  await openEditor(page, mission.id);
});

test.afterEach(async ({ page, baseURL }) => {
  if (mission) await deleteMission(page, baseURL!, mission.id);
});

async function addWaypoints(page: Page, points: [number, number][]): Promise<void> {
  await mapTool(page, 'Waypoint').click();
  for (const [dx, dy] of points) await clickMap(page, dx, dy);
  await page.keyboard.press('Escape');
}

test('add 3 waypoints, autosave, reload, still 3', async ({ page }) => {
  const before = await missionItems(page).count();
  await addWaypoints(page, [
    [-150, 0],
    [0, -100],
    [150, 0],
  ]);
  await expect(missionItems(page)).toHaveCount(before + 3);
  await expectSaved(page);

  await page.reload();
  await openEditor(page, mission.id);
  await expect(missionItems(page)).toHaveCount(before + 3);
});

test('apply a template', async ({ page }) => {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('dialog', { name: 'More actions' }).getByRole('button', { name: 'Template…' }).click();
  const picker = page.getByRole('dialog', { name: 'Start from a template' });
  const card = picker.getByRole('button', { name: /^Simple Survey Grid/ });
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  await picker.getByRole('button', { name: /Use template|Replace items/ }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByText(/Applied template/).first()).toBeVisible();
  expect(await missionItems(page).count()).toBeGreaterThan(0);
  await expectSaved(page);
});

test('survey generation is a single undo step', async ({ page }) => {
  await addWaypoints(page, [[-250, 150]]);
  const before = await missionItems(page).count();

  await page.getByRole('button', { name: 'Plan' }).click();
  await page.getByRole('dialog', { name: 'Plan tools' }).getByRole('button', { name: /Survey area/ }).click();
  // No area yet: the survey-area drawing tool is armed.
  await expect(mapTool(page, 'Survey area')).toHaveAttribute('aria-pressed', 'true');
  for (const [dx, dy] of [
    [-120, -90],
    [120, -90],
    [120, 90],
    [-120, 90],
  ] as const)
    await clickMap(page, dx, dy);
  await page.getByRole('status').getByRole('button', { name: 'Finish' }).click();

  const add = page.getByRole('button', { name: 'Add survey' });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText(/-line survey/).first()).toBeVisible();
  const after = await missionItems(page).count();
  expect(after).toBeGreaterThan(before + 2);

  // One undo removes the whole survey.
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(missionItems(page)).toHaveCount(before);
});

test('draw a keep-out zone across a leg and see a check', async ({ page }) => {
  await addWaypoints(page, [
    [-220, 0],
    [220, 0],
  ]);
  await mapTool(page, 'Zone').click();
  const hint = page.getByRole('status').filter({ has: page.getByRole('radiogroup', { name: 'Zone type' }) });
  await expect(hint).toBeVisible();
  for (const [dx, dy] of [
    [-50, -90],
    [50, -90],
    [50, 90],
    [-50, 90],
  ] as const)
    await clickMap(page, dx, dy);
  await hint.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/Keep-out 1 added/).first()).toBeVisible();

  await page.getByRole('tab', { name: /^Checks/ }).click();
  await expect(page.getByText(/crosses keep-out zone "Keep-out 1"/).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Pre-flight checks: .*error/ })).toBeVisible();
});

test('export .plan downloads valid QGroundControl JSON', async ({ page }) => {
  await addWaypoints(page, [
    [-100, 0],
    [100, 0],
  ]);
  await expectSaved(page);
  await page.getByRole('button', { name: 'Export mission' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('dialog', { name: 'Export formats' }).getByRole('button', { name: /QGroundControl/ }).click();
  const anyway = page.getByRole('button', { name: /Export anyway/ });
  if (await anyway.isVisible().catch(() => false)) await anyway.click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.plan$/);
  const plan = JSON.parse(readFileSync(await file.path(), 'utf8')) as {
    fileType: string;
    mission: { items: unknown[]; plannedHomePosition: number[] };
  };
  expect(plan.fileType).toBe('Plan');
  expect(plan.mission.items.length).toBeGreaterThanOrEqual(2);
  expect(plan.mission.plannedHomePosition).toHaveLength(3);
});
