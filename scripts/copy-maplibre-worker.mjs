// MapLibre GL 6 ships its web worker as separate ES modules that the app bundler
// does not emit. Copy them (pinned to the installed version) into public/ so the
// editor can point setWorkerUrl() at a same-origin URL (CSP worker-src 'self').
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('maplibre-gl/package.json'));
const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'maplibre');
mkdirSync(out, { recursive: true });
for (const file of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  copyFileSync(join(pkgDir, 'dist', file), join(out, file));
}
