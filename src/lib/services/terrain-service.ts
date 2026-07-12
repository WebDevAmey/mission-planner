const elevationCache = new Map<string, number>();

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
      const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          locations: chunk.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = (await response.json()) as {
        results: { elevation: number }[];
      };

      for (let i = 0; i < chunk.length; i++) {
        const elev = data.results[i]?.elevation ?? 0;
        results[chunk[i].idx] = elev;
        elevationCache.set(cacheKey(chunk[i].lat, chunk[i].lng), elev);
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

export function getGroundClearance(waypointAltM: number, terrainElevM: number): number {
  return waypointAltM - terrainElevM;
}

/** Build sample points along the route: waypoints + one midpoint per segment */
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
      const R = 6371000;
      const φ1 = (item.latitude * Math.PI) / 180;
      const φ2 = (next.latitude * Math.PI) / 180;
      const Δφ = ((next.latitude - item.latitude) * Math.PI) / 180;
      const Δλ = ((next.longitude - item.longitude) * Math.PI) / 180;
      const a =
        Math.sin(Δφ / 2) ** 2 +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
      const segDist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      // Midpoint
      const midLat = (item.latitude + next.latitude) / 2;
      const midLng = (item.longitude + next.longitude) / 2;
      out.push({ lat: midLat, lng: midLng, distFromStart: cumDist + segDist / 2 });

      cumDist += segDist;
    }
  }

  return out;
}
