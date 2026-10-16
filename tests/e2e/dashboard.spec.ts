import { expect, test } from '@playwright/test';
import { AUTH_FILE, deleteMission, uniqueSuffix } from './helpers';

test.use({ storageState: AUTH_FILE });

test('dashboard: create, rename and delete a mission', async ({ page, baseURL }) => {
  const name = `E2E create ${uniqueSuffix()}`;
  const renamed = `${name} renamed`;
  let id: string | undefined;
  try {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /^Missions/ })).toBeVisible();

    // Create from the dialog; the app opens the editor for the new mission.
    await page.getByRole('button', { name: 'New mission' }).first().click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill(name);
    await dialog.getByRole('button', { name: 'Create mission' }).click();
    await page.waitForURL(/\/missions\/[^/]+$/);
    id = page.url().split('/').pop();
    await expect(page.getByRole('button', { name: new RegExp(`Mission name: ${name}`) })).toBeVisible();

    // Back on the dashboard the card is listed; rename it.
    await page.goto('/dashboard');
    await page.getByRole('radio', { name: 'Grid view' }).or(page.getByLabel('Grid view')).first().click();
    await page.getByRole('button', { name: `More actions for ${name}` }).click();
    await page.getByRole('dialog', { name: 'Mission actions' }).getByRole('button', { name: 'Rename…' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename mission' });
    await rename.getByLabel('Name').fill(renamed);
    await rename.getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByRole('button', { name: `More actions for ${renamed}` })).toBeVisible();

    // Delete it.
    await page.getByRole('button', { name: `More actions for ${renamed}` }).click();
    await page.getByRole('dialog', { name: 'Mission actions' }).getByRole('button', { name: 'Delete…' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete mission' }).click();
    await expect(page.getByRole('button', { name: `More actions for ${renamed}` })).toHaveCount(0);
    id = undefined;
  } finally {
    if (id && baseURL) await deleteMission(page, baseURL, id);
  }
});
