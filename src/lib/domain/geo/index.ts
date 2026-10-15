export * from './projection';
export * from './planar';
export * from './polygon';

import { createProjection, type LngLat } from './projection';
import { openRing, validatePolygon, type PolygonValidity } from './polygon';

/** Validates a [lng, lat] ring (closed or open) in a local metric frame. */
export function validateLngLatPolygon(ring: LngLat[]): PolygonValidity {
  const open = openRing(ring);
  if (open.some(([lng, lat]) => !(Math.abs(lat) <= 90 && Math.abs(lng) <= 180))) {
    return { ok: false, reason: 'invalid_coordinates' };
  }
  if (open.length < 3) return { ok: false, reason: 'too_few_points' };
  const proj = createProjection(open[0]);
  return validatePolygon(open.map(proj.toLocal));
}
