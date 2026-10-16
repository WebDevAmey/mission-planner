import { expect, test } from '@playwright/test';
import { apiLogin, AUTH_FILE, DEMO, originHeaders, uniqueSuffix } from './helpers';

test.use({ storageState: AUTH_FILE });

test('settings: change the display name', async ({ page, baseURL }) => {
  const res = await page.request.get('/api/account');
  const original = ((await res.json()) as { user?: { name?: string | null }; account?: { name?: string | null } });
  const before = original.user?.name ?? original.account?.name ?? 'Demo Operator';
  const next = `Pilot ${uniqueSuffix()}`;
  try {
    await page.goto('/settings');
    const field = page.getByLabel('Name', { exact: true });
    await field.fill(next);
    await page.getByRole('button', { name: 'Save name' }).click();
    await expect(page.getByText(/name (saved|updated)/i).first()).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue(next);
  } finally {
    await page.request.patch('/api/account', { headers: originHeaders(baseURL!), data: { name: before } });
  }
});

test('settings: sign out other sessions', async ({ page, baseURL }) => {
  // A second device signs in.
  const other = await apiLogin(baseURL!, DEMO);
  expect((await other.get('/api/auth/me')).status()).toBe(200);

  await page.goto('/settings');
  const sessions = page.getByRole('region', { name: 'Sessions' }).or(page.locator('section', { has: page.getByRole('heading', { name: 'Sessions' }) }));
  await expect(sessions.getByText('This device')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out other devices' }).click();
  await expect(page.getByRole('button', { name: 'Sign out other devices' })).toBeDisabled();

  // The other device is signed out; this one is not.
  expect((await other.get('/api/auth/me')).status()).toBe(401);
  expect((await page.request.get('/api/auth/me')).status()).toBe(200);
  await other.dispose();
});
