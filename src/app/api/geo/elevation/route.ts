import { z } from 'zod';
import { apiError, authorize, readJsonBody, validationError } from '@/lib/http/api';
import { TtlCache, WindowLimiter } from '@/lib/http/ttl-cache';
import { fetchUpstreamJson, upstreamUrl } from '@/lib/http/upstream';

/**
 * POST /api/geo/elevation `{ points: [{ lat, lng }] }` (1–100 points)
 * → `{ ok: true, elevations: (number | null)[] }` in metres AMSL, same order.
 * Per-point results are cached (rounded to ~1 m); only misses go upstream.
 */

const bodySchema = z.object({
  points: z
    .array(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }))
    .min(1)
    .max(100),
});

const ELEVATION_URL = upstreamUrl(process.env.ELEVATION_URL, 'https://api.open-elevation.com/api/v1/lookup');
/** The editor sends at most a few 100-point chunks per route change (debounced). */
const perUser = new WindowLimiter(60, 60 * 1000);
const cache = new TtlCache<number>(20000, 7 * 24 * 60 * 60 * 1000);

const keyOf = (p: { lat: number; lng: number }) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, { maxBytes: 32 * 1024 });
  if (!body.ok) return body.response;
  const parsed = bodySchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);
  const { points } = parsed.data;

  const wait = perUser.take(user.id);
  if (wait > 0) {
    const retryAfterS = Math.ceil(wait / 1000);
    return apiError(429, 'RATE_LIMITED', 'Too many elevation lookups. Try again in a moment.', { retryAfterS }, {
      headers: { 'Retry-After': String(retryAfterS) },
    });
  }

  const elevations: (number | null)[] = points.map((p) => cache.get(keyOf(p)) ?? null);
  const missing = points.map((p, i) => ({ p, i })).filter(({ i }) => elevations[i] === null);

  if (missing.length) {
    try {
      const data = (await fetchUpstreamJson(ELEVATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ locations: missing.map(({ p }) => ({ latitude: p.lat, longitude: p.lng })) }),
        timeoutMs: 10000,
        maxBytes: 256 * 1024,
      })) as { results?: { elevation?: number }[] } | null;
      const results = Array.isArray(data?.results) ? data.results : [];
      missing.forEach(({ p, i }, j) => {
        const e = results[j]?.elevation;
        if (typeof e === 'number' && Number.isFinite(e)) {
          elevations[i] = e;
          cache.set(keyOf(p), e);
        }
      });
    } catch {
      return apiError(502, 'UPSTREAM_FAILED', 'Elevation service is unavailable right now');
    }
  }

  return Response.json({ ok: true, elevations });
}
