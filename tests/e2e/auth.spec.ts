import { expect, test } from '@playwright/test';
import { DEMO, uniqueSuffix } from './helpers';

test.describe('authentication', () => {
  test('sign up a new user, sign out, and sign back in', async ({ page }) => {
    const email = `e2e-${uniqueSuffix()}@example.com`;
    const password = 'correct-horse-battery';

    await page.goto('/signup');
    await page.getByLabel('Name (optional)').fill('E2E Pilot');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /^Missions/ })).toBeVisible();

    // Sign out from the account menu.
    await page.getByRole('button', { name: 'Account menu' }).click();
    await page.getByRole('dialog', { name: 'Account' }).getByRole('button', { name: 'Sign out' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/dashboard'));

    // The session is gone: protected pages bounce to login.
    await page.goto('/dashboard');
    await page.waitForURL(/\/login/);

    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/dashboard/);
  });

  test('wrong password shows a generic error and stays on login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByLabel('Password', { exact: true }).fill('not-the-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /incorrect email or password/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('demo user signs in with the form', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO.email);
    await page.getByLabel('Password', { exact: true }).fill(DEMO.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /^Missions/ })).toBeVisible();
  });

  test('an off-site ?next= after sign-in stays in the app', async ({ page, baseURL }) => {
    for (const next of ['//example.com/phish', 'https://example.com/', '/\\example.com']) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.getByLabel('Email').fill(DEMO.email);
      await page.getByLabel('Password', { exact: true }).fill(DEMO.password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await page.waitForURL(/\/dashboard/);
      expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
    }
  });
});
