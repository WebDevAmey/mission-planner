import { haversineDistance } from '@/lib/utils';
import { fetchUpstreamJson } from '@/lib/http/upstream';
import { aglM, sampleSpacingM } from '@/lib/domain/metrics';

/** Process-wide cache; bounded so a long-running server can't grow it without limit. */
export const ELEVATION_CACHE_MAX = 20_000;
const elevationCache = new Map<string, number>();

function remember(key: string, elevation: number): void {
  if (elevationCache.size >= ELEVATION_CACHE_MAX && !elevationCache.has(key)) {
    // Maps iterate in insertion order: drop the oldest entry.
    const oldest = elevationCache.keys().next().value;
    if (oldest !== undefined) elevationCache.delete(oldest);
  }
  elevationCache.set(key, elevation);
}

export const elevationCacheSize = (): number => elevationCache.size;

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(7)},${lng.toFixed(7)}`;
}

export interface TerrainPoint {
  lat: number;
  lng: number;
  elevation: number | null;
}

export async function getElevations(
  points: { lat: number; lng: number }[]
): Promise<number[]> {
  if (points.length === 0) return [];

  const results: number[] = new Array(points.length).fill(0);
  const toFetch: { idx: number; lat: number; lng: number }[] = [];

  for (let i = 0; i < points.length; i++) {
    const key = cacheKey(points[i].lat, points[i].lng);
    const cached = elevationCache.get(key);
    if (cached !== undefined) {
      results[i] = cached;
    } else {
      toFetch.push({ idx: i, ...points[i] });
    }
  }

  if (toFetch.length === 0) return results;

  // Batch in chunks of 100
  const CHUNK_SIZE = 100;
  for (let start = 0; start < toFetch.length; start += CHUNK_SIZE) {
    const chunk = toFetch.slice(start, start + CHUNK_SIZE);
    try {
      const data = (await fetchUpstreamJson('https://api.open-elevation.com/api/v1/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          locations: chunk.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        }),
        timeoutMs: 8000,
        maxBytes: 256 * 1024,
      })) as { results?: { elevation: number }[] };

      for (let i = 0; i < chunk.length; i++) {
        const elev = data.results?.[i]?.elevation ?? 0;
        results[chunk[i].idx] = elev;
        remember(cacheKey(chunk[i].lat, chunk[i].lng), elev);
      }
    } catch {
      // Leave as 0 on error; caller shows warning
      for (const p of chunk) {
        results[p.idx] = 0;
      }
      throw new Error('TERRAIN_UNAVAILABLE');
    }
  }

  return results;
}

export function clearElevationCache(): void {
  elevationCache.clear();
}

/**
 * Height above ground. Altitudes are relative to home, so the home elevation must be added:
 * `agl = relAlt + homeElev - terrainElev`. `homeElevM` defaults to 0 only for backward
 * compatibility; always pass it (see `aglM` in `@/lib/domain/metrics`).
 */
export function getGroundClearance(waypointAltM: number, terrainElevM: number, homeElevM = 0): number {
  return aglM(waypointAltM, homeElevM, terrainElevM);
}

export { aglM, buildClearanceSamples, computeClearanceProfile, sampleSpacingM } from '@/lib/domain/metrics';

/**
 * Sample points along the route: every waypoint plus points every max(30 m, leg/50) along
 * each leg (not just midpoints).
 */
export function buildTerrainSamplePoints(
  spatialItems: { latitude: number; longitude: number; altitude: number | null }[]
): { lat: number; lng: number; distFromStart: number }[] {
  const out: { lat: number; lng: number; distFromStart: number }[] = [];
  let cumDist = 0;
  for (let i = 0; i < spatialItems.length; i++) {
    const item = spatialItems[i];
    out.push({ lat: item.latitude, lng: item.longitude, distFromStart: cumDist });
    if (i < spatialItems.length - 1) {
      const next = spatialItems[i + 1];
      const segDist = haversineDistance(item.latitude, item.longitude, next.latitude, next.longitude);
      const n = Math.max(1, Math.ceil(segDist / sampleSpacingM(segDist)));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push({
          lat: item.latitude + (next.latitude - item.latitude) * t,
          lng: item.longitude + (next.longitude - item.longitude) * t,
          distFromStart: cumDist + segDist * t,
        });
      }
      cumDist += segDist;
    }
  }
  return out;
}
