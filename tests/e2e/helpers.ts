import { expect, request, type APIRequestContext, type Page } from '@playwright/test';

export const DEMO = { email: 'demo@example.com', password: 'password1234' } as const;
export const AUTH_FILE = 'tests/e2e/.auth/demo.json';

/** Unique per run, so specs can be repeated against the same database. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Mutating API calls must carry a same-origin Origin header (CSRF guard). */
export function originHeaders(baseURL: string): Record<string, string> {
  return { origin: new URL(baseURL).origin };
}

/** Signs in through the API and returns a request context holding the session cookie. */
export async function apiLogin(baseURL: string, creds: { email: string; password: string } = DEMO): Promise<APIRequestContext> {
  // A fresh device: inside a test, request.newContext() inherits the test's `use` options,
  // including storageState. Sending that cookie would make the login revoke the page's
  // own session (sign-in replaces the browser's previous session).
  const ctx = await request.newContext({
    baseURL,
    extraHTTPHeaders: originHeaders(baseURL),
    storageState: { cookies: [], origins: [] },
  });
  const res = await ctx.post('/api/auth/login', { data: creds });
  expect(res.status(), `login ${creds.email}: ${await res.text()}`).toBe(200);
  return ctx;
}

export interface CreatedMission {
  id: string;
  name: string;
}

/** Creates a mission for the page's signed-in user (shares the page's cookies). */
export async function createMission(
  page: Page,
  baseURL: string,
  name: string,
  home: { latitude: number; longitude: number } = { latitude: 47.3769, longitude: 8.5417 }
): Promise<CreatedMission> {
  const res = await page.request.post('/api/missions', {
    headers: originHeaders(baseURL),
    data: { name, home: { ...home, altitude: 0 } },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { mission: CreatedMission };
  return { id: body.mission.id, name: body.mission.name };
}

export async function deleteMission(page: Page, baseURL: string, id: string): Promise<void> {
  await page.request.delete(`/api/missions/${id}`, { headers: originHeaders(baseURL) }).catch(() => undefined);
}

/** Opens the editor and waits until the map and item list are interactive. */
export async function openEditor(page: Page, id: string): Promise<void> {
  await page.goto(`/missions/${id}`);
  await expect(page.getByLabel('Mission map')).toBeAttached({ timeout: 30_000 });
  await expect(page.getByRole('navigation', { name: 'Map tools' })).toBeVisible();
  // Let MapLibre finish its first layout so clicks land on the canvas.
  await page.waitForFunction(() => !!document.querySelector('.maplibregl-canvas'));
  await page.waitForTimeout(1000);
}

export function mapTool(page: Page, label: string) {
  return page.getByRole('navigation', { name: 'Map tools' }).getByRole('button', { name: label, exact: true });
}

/** Clicks the map at an offset (px) from its centre. */
export async function clickMap(page: Page, dx: number, dy: number, opts: { double?: boolean } = {}): Promise<void> {
  const box = await page.getByLabel('Mission map').boundingBox();
  if (!box) throw new Error('map not laid out');
  const x = box.x + box.width / 2 + dx;
  const y = box.y + box.height / 2 + dy;
  if (opts.double) await page.mouse.dblclick(x, y);
  else await page.mouse.click(x, y);
  await page.waitForTimeout(350);
}

export function missionItems(page: Page) {
  return page.getByRole('list', { name: 'Mission items' }).getByRole('listitem');
}

export async function expectSaved(page: Page): Promise<void> {
  await expect(page.getByText(/^Saved/).first()).toBeVisible({ timeout: 20_000 });
}
