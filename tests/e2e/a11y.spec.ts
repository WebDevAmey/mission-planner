import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { AUTH_FILE, createMission, deleteMission, openEditor, uniqueSuffix } from './helpers';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function expectNoSeriousViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    // The WebGL canvas is an image of the map; its accessible surface is the item list and inspector.
    .exclude('.maplibregl-canvas')
    .analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`);
  expect(summary, `${name} has serious accessibility violations`).toEqual([]);
}

test.describe('landing keyboard navigation', () => {
  test('primary nav is reachable in order with a visible focus ring', async ({ page }) => {
    await page.goto('/');
    const expected = ['Skip to content', 'Flight Deck home', 'Product', 'How it works', 'Formats', 'FAQ', 'Sign in', 'Start planning'];
    for (const label of expected) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toHaveAccessibleName(label);
      const outline = await focused.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow };
      });
      expect(outline.style !== 'none' && outline.width > 0 || outline.shadow !== 'none', `${label} has no focus indicator`).toBe(true);
    }
  });

  test('nav links move to their section and the skip link reaches main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'How it works' }).focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#how-it-works$/);
    await expect(page.locator('#how-it-works')).toBeInViewport();
  });
});

test.describe('axe: no serious or critical violations', () => {
  test('landing', async ({ page }) => {
    await page.goto('/');
    await expectNoSeriousViolations(page, 'landing');
  });

  test('login', async ({ page }) => {
    await page.goto('/login');
    await expectNoSeriousViolations(page, 'login');
  });

  test.describe('signed in', () => {
    test.use({ storageState: AUTH_FILE });

    test('dashboard', async ({ page }) => {
      await page.goto('/dashboard');
      await expect(page.getByRole('heading', { name: /^Missions/ })).toBeVisible();
      await expect(page.getByLabel('Loading missions')).toHaveCount(0);
      await expectNoSeriousViolations(page, 'dashboard');
    });

    test('editor', async ({ page, baseURL }) => {
      const m = await createMission(page, baseURL!, `E2E axe ${uniqueSuffix()}`);
      try {
        await openEditor(page, m.id);
        await expectNoSeriousViolations(page, 'editor');
      } finally {
        await deleteMission(page, baseURL!, m.id);
      }
    });
  });
});
