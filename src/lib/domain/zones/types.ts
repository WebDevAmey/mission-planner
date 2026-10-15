import type { LngLat } from '@/lib/domain/geo';

export type ZoneKind = 'no_fly' | 'keep_in' | 'keep_out';
export type ZoneShape = 'circle' | 'polygon';

/** Mission zone, mirrors the `Zone` table (TECHNICAL_SPEC §3.2). */
export interface Zone {
  id: string;
  kind: ZoneKind;
  shape: ZoneShape;
  label: string;
  enabled: boolean;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusM?: number | null;
  /** Open or closed ring of [lng, lat]. */
  vertices?: LngLat[] | null;
  minAltM?: number | null;
  maxAltM?: number | null;
}

/** no_fly and keep_out zones must not be entered; keep_in zones must not be left. */
export const isExclusion = (z: Zone): boolean => z.kind === 'no_fly' || z.kind === 'keep_out';
export const isInclusion = (z: Zone): boolean => z.kind === 'keep_in';

export const ZONE_KIND_LABELS: Record<ZoneKind, string> = {
  no_fly: 'No-fly',
  keep_in: 'Keep-in',
  keep_out: 'Keep-out',
};
