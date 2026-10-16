import { afterEach, describe, expect, it, vi } from 'vitest';
import { appOrigin } from '@/lib/http/app-origin';

const request = new Request('http://attacker.example/api/auth/forgot-password');

describe('appOrigin', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses APP_URL when it is a full URL', () => {
    vi.stubEnv('APP_URL', 'https://planner.example.com/some/path');
    expect(appOrigin(request)).toBe('https://planner.example.com');
  });

  it('accepts APP_URL without a scheme', () => {
    vi.stubEnv('APP_URL', 'mission-planner.example.app');
    expect(appOrigin(request)).toBe('https://mission-planner.example.app');
  });

  it('keeps an explicit http scheme for local development', () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000');
    expect(appOrigin(request)).toBe('http://localhost:3000');
  });

  it('falls back to the Vercel production URL, never the request host', () => {
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', 'planner.vercel.app');
    expect(appOrigin(request)).toBe('https://planner.vercel.app');
  });
});
