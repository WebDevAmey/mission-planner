import { PlannerAction } from '@/lib/mavlink/commands';
import {
  type LngLat,
  type Vec,
  haversineM,
  minWidth,
  openRing,
  projectionFor,
  rotate,
} from '@/lib/domain/geo';
import { createMissionItem } from '@/lib/domain/items';
import type { MissionItem, MissionPlanSettings } from '@/types/mission';

export interface CameraSpec {
  sensorWidthMm: number;
  sensorHeightMm: number;
  focalLengthMm: number;
}

export interface SurveyParams {
  /** Area to cover, [lng, lat] ring (open or closed). */
  polygon: LngLat[];
  altitudeM: number;
  /** Line spacing in metres. If omitted it is derived from `camera` and `sideOverlap`. */
  spacingM?: number;
  camera?: CameraSpec;
  /** 0..0.95, default 0.7. */
  sideOverlap?: number;
  /** 0..0.95, default 0.8. */
  frontOverlap?: number;
  /** Line bearing in degrees clockwise from north. Default: polygon's minimum-width direction. */
  angleDeg?: number;
  /** Extend each pass beyond the boundary by this many metres (default 0). */
  turnaroundM?: number;
  /** Emit DO_SET_CAM_TRIGG_DIST before/after the pattern (default true when a camera is given). */
  triggerCamera?: boolean;
}

export interface SurveyResult {
  /** Passes in flight order, each [start, end]. */
  lines: [LngLat, LngLat][];
  /** Flight path through all pass ends. */
  path: LngLat[];
  spacingM: number;
  angleDeg: number;
  triggerDistanceM: number | null;
  lengthM: number;
  lineCount: number;
}

/** Ground footprint (metres) of one image at `altitudeM`. */
export function cameraFootprint(cam: CameraSpec, altitudeM: number): { widthM: number; heightM: number } {
  return {
    widthM: (altitudeM * cam.sensorWidthMm) / cam.focalLengthMm,
    heightM: (altitudeM * cam.sensorHeightMm) / cam.focalLengthMm,
  };
}

/**
 * Each pass becomes two waypoints and a mission holds at most 2,000 items, so more passes
 * than this can never be saved; stop before building (and previewing) them.
 */
export const MAX_SURVEY_LINES = 1000;

const clampOverlap = (x: number | undefined, d: number) => Math.min(0.95, Math.max(0, x ?? d));

export function surveySpacing(p: Pick<SurveyParams, 'spacingM' | 'camera' | 'sideOverlap' | 'frontOverlap' | 'altitudeM'>): {
  spacingM: number;
  triggerDistanceM: number | null;
} {
  const fp = p.camera ? cameraFootprint(p.camera, p.altitudeM) : null;
  const spacingM = p.spacingM ?? (fp ? fp.widthM * (1 - clampOverlap(p.sideOverlap, 0.7)) : NaN);
  if (!(spacingM > 0)) throw new Error('Survey needs spacingM > 0 or a camera');
  const triggerDistanceM = fp ? fp.heightM * (1 - clampOverlap(p.frontOverlap, 0.8)) : null;
  return { spacingM, triggerDistanceM };
}

/** Bearing (deg from north, clockwise) <-> math angle (rad from east, counter-clockwise). */
const bearingToMath = (deg: number) => ((90 - deg) * Math.PI) / 180;
const mathToBearing = (rad: number) => (((90 - (rad * 180) / Math.PI) % 180) + 180) % 180;

/** x-intervals where the horizontal line y = `y` is inside `poly` (even-odd pairing). */
export function scanlineIntervals(poly: Vec[], y: number): [number, number][] {
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[j];
    const b = poly[i];
    if (a.y <= y !== b.y <= y) xs.push(a.x + ((y - a.y) * (b.x - a.x)) / (b.y - a.y));
  }
  xs.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 1e-6) out.push([xs[k], xs[k + 1]]);
  return out;
}

/**
 * Boustrophedon (lawnmower) coverage of a polygon. Concave shapes are handled by pairing
 * sorted scanline intersections, so one pass can contain several inside intervals.
 */
export function generateSurvey(params: SurveyParams): SurveyResult {
  const ring = openRing(params.polygon);
  if (ring.length < 3) throw new Error('Survey polygon needs at least 3 vertices');
  const { spacingM, triggerDistanceM } = surveySpacing(params);
  const proj = projectionFor(ring);
  const local = ring.map(proj.toLocal);
  const theta = params.angleDeg != null ? bearingToMath(params.angleDeg) : minWidth(local).angle;
  const rot = local.map((p) => rotate(p, -theta));
  const ys = rot.map((p) => p.y);
  const ymin = Math.min(...ys);
  const ymax = Math.max(...ys);
  const height = ymax - ymin;
  const n = Math.max(1, Math.ceil(height / spacingM - 1e-9));
  if (n > MAX_SURVEY_LINES) {
    throw new Error(
      `This area needs ${n.toLocaleString('en-US')} passes at ${Math.round(spacingM * 10) / 10} m spacing; a mission holds at most ${MAX_SURVEY_LINES * 2} waypoints. Increase the spacing or split the area.`
    );
  }
  const y0 = ymin + (height - (n - 1) * spacingM) / 2;
  const ext = Math.max(0, params.turnaroundM ?? 0);

  const passes: [Vec, Vec][] = [];
  let lineIdx = 0;
  for (let k = 0; k < n; k++) {
    const y = y0 + k * spacingM;
    let ivs = scanlineIntervals(rot, y);
    if (ivs.length === 0) continue;
    const forward = lineIdx++ % 2 === 0;
    if (!forward) ivs = ivs.map(([a, b]) => [b, a] as [number, number]).reverse();
    ivs.forEach(([a, b], idx) => {
      const sgn = forward ? 1 : -1;
      const start = idx === 0 ? a - sgn * ext : a;
      const end = idx === ivs.length - 1 ? b + sgn * ext : b;
      passes.push([{ x: start, y }, { x: end, y }]);
    });
  }

  const toLL = (v: Vec) => proj.toLngLat(rotate(v, theta));
  const lines = passes.map(([a, b]) => [toLL(a), toLL(b)] as [LngLat, LngLat]);
  const path = lines.flat();
  let lengthM = 0;
  for (let i = 1; i < path.length; i++) lengthM += haversineM(path[i - 1], path[i]);
  return {
    lines,
    path,
    spacingM,
    angleDeg: mathToBearing(theta),
    triggerDistanceM,
    lengthM,
    lineCount: lineIdx,
  };
}

/** Mission items for a survey: optional camera trigger on/off around one WAYPOINT per pass end. */
export function surveyToItems(
  survey: SurveyResult,
  settings: MissionPlanSettings,
  opts: { altitudeM: number; speedMs?: number; triggerCamera?: boolean }
): MissionItem[] {
  const items: MissionItem[] = [];
  const trigger = (opts.triggerCamera ?? true) && survey.triggerDistanceM != null;
  const cam = (dist: number) => {
    const it = createMissionItem(PlannerAction.CAM_TRIGG_DIST, 0, settings);
    it.parameters = { ...it.parameters, param1: Math.round(dist * 100) / 100, param3: dist > 0 ? 1 : 0 };
    it.notes = 'generated: survey';
    return it;
  };
  survey.path.forEach(([lng, lat], i) => {
    const wp = createMissionItem(PlannerAction.WAYPOINT, 0, settings, { latitude: lat, longitude: lng, altitude: opts.altitudeM });
    wp.notes = 'generated: survey';
    if (i === 0 && opts.speedMs) wp.speed = opts.speedMs;
    items.push(wp);
    if (i === 0 && trigger) items.push(cam(survey.triggerDistanceM!));
  });
  if (trigger) items.push(cam(0));
  return items.map((it, i) => ({ ...it, sequence: i }));
}
