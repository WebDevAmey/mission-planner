import { z } from 'zod';
import { apiError, authorize, validationError } from '@/lib/http/api';
import { Spacing, TtlCache, sleep } from '@/lib/http/ttl-cache';

/**
 * GET /api/geo/search?q=&limit= — geocoding proxy (S9, DECISIONS D-05).
 * → `{ ok: true, results: GeoResult[] }`. Cached 24 h per query; 1 request/s per
 * user (429 otherwise) and at most 1 request/s upstream per instance, as the
 * Nominatim usage policy requires. Change provider here only.
 */

export interface GeoResult {
  name: string;
  lat: number;
  lng: number;
  /** [minLng, minLat, maxLng, maxLat] when the provider returns one. */
  bbox: [number, number, number, number] | null;
  type: string | null;
}

const querySchema = z.object({
  q: z.string().trim().min(2, 'Enter at least 2 characters').max(200),
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

const NOMINATIM_URL = process.env.GEOCODER_URL || 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.GEOCODER_USER_AGENT || 'FlightDeck-MissionPlanner/1.0 (server proxy)';

const cache = new TtlCache<GeoResult[]>(1000, 24 * 60 * 60 * 1000);
const perUser = new Spacing(1000);
let upstreamNext = 0;

interface NominatimRow {
  display_name?: string;
  lat?: string;
  lon?: string;
  boundingbox?: [string, string, string, string];
  type?: string;
}

function toResult(row: NominatimRow): GeoResult | null {
  const lat = Number(row.lat);
  const lng = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const bb = row.boundingbox?.map(Number);
  return {
    name: row.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    lat,
    lng,
    // Nominatim's boundingbox is [minLat, maxLat, minLng, maxLng].
    bbox: bb && bb.length === 4 && bb.every(Number.isFinite) ? [bb[2], bb[0], bb[3], bb[1]] : null,
    type: row.type ?? null,
  };
}

export async function GET(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { q, limit } = parsed.data;

  const key = `${q.toLowerCase()}|${limit}`;
  const cached = cache.get(key);
  if (cached) return Response.json({ ok: true, results: cached, cached: true });

  const wait = perUser.take(user.id);
  if (wait > 0) {
    const retryAfterS = Math.ceil(wait / 1000);
    return apiError(429, 'RATE_LIMITED', 'Searching too fast. Try again in a moment.', { retryAfterS }, {
      headers: { 'Retry-After': String(retryAfterS) },
    });
  }

  // Space upstream calls ≥ 1 s apart within this instance.
  const now = Date.now();
  const delay = Math.max(0, upstreamNext - now);
  upstreamNext = Math.max(now, upstreamNext) + 1000;
  if (delay > 0) await sleep(delay);

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set('q', q);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', String(limit));

  let rows: NominatimRow[];
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json', 'Accept-Language': 'en' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return apiError(502, 'UPSTREAM_FAILED', 'Location search is unavailable right now');
    rows = (await res.json()) as NominatimRow[];
  } catch {
    return apiError(502, 'UPSTREAM_FAILED', 'Location search is unavailable right now');
  }

  const results = (Array.isArray(rows) ? rows : []).map(toResult).filter((r): r is GeoResult => r !== null);
  cache.set(key, results);
  return Response.json({ ok: true, results, attribution: '© OpenStreetMap contributors' });
}
