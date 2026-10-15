import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Integration suite: route handlers against a real scratch Postgres.
// Files are *.itest.ts so the unit run (`pnpm test`) never picks them up; suites also skip without DATABASE_URL.
// Run: DATABASE_URL=... vitest run --config tests/integration/vitest.config.ts
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.itest.ts'],
    root: fileURLToPath(new URL('../..', import.meta.url)),
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
