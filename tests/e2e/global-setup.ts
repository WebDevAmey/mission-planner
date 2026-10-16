import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FullConfig } from '@playwright/test';
import { apiLogin, AUTH_FILE } from './helpers';

/** Signs the seeded demo user in once and stores the session for specs that start signed in. */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) throw new Error('baseURL is not configured');
  const ctx = await apiLogin(baseURL);
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await ctx.storageState({ path: AUTH_FILE });
  await ctx.dispose();
}
