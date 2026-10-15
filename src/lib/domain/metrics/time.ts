import { PlannerAction } from '@/lib/mavlink/commands';
import { haversineM } from '@/lib/domain/geo';
import { legItemIds, missionLegs } from '@/lib/domain/mission';
import type { MissionPlan } from '@/types/mission';

/** Vehicle performance assumptions for estimates (TECHNICAL_SPEC §7.5). */
export interface FlightModel {
  /** Cruise speed used until a speed change, m/s. Defaults to mission settings. */
  cruiseSpeedMs?: number;
  /** Horizontal acceleration/deceleration, m/s². */
  accelMs2: number;
  /** Climb rate, m/s. */
  climbRateMs: number;
  /** Descent rate, m/s. */
  descentRateMs: number;
}

export const DEFAULT_FLIGHT_MODEL: FlightModel = { accelMs2: 2, climbRateMs: 3, descentRateMs: 1.5 };

/**
 * Time to fly `d` metres starting and ending at rest with a trapezoidal speed profile
 * (accelerate at `a` to `v`, cruise, decelerate). Falls back to a triangular profile on
 * short legs that never reach cruise speed.
 */
export function trapezoidTime(d: number, v: number, a: number): number {
  if (d <= 0) return 0;
  if (v <= 0) return Infinity;
  if (a <= 0) return d / v;
  return d >= (v * v) / a ? d / v + v / a : 2 * Math.sqrt(d / a);
}

export interface LegMetric {
  itemIds: string[];
  distanceM: number;
  speedMs: number;
  timeS: number;
}

export interface MissionMetrics {
  distanceM: number;
  /** Total estimated time incl. legs, climbs, dwell, takeoff and landing. */
  timeS: number;
  legTimeS: number;
  dwellS: number;
  takeoffLandS: number;
  legs: LegMetric[];
  itemCount: number;
  spatialCount: number;
  maxAltM: number;
  minAltM: number;
  /** True when the mission contains an unbounded loiter (time is then a lower bound). */
  unbounded: boolean;
  /** Estimated time / rated endurance, null when no rating is set. */
  enduranceFraction: number | null;
}

/** Effective commanded speed at each item index (speed changes persist). */
function speedProfile(mission: MissionPlan, cruise: number): number[] {
  let v = cruise;
  return mission.items.map((it) => {
    if (it.action === PlannerAction.SET_SPEED && it.parameters.param2 > 0) v = it.parameters.param2;
    else if (it.speed && it.speed > 0) v = it.speed;
    return v;
  });
}

function dwellFor(mission: MissionPlan, speeds: number[]): { dwellS: number; unbounded: boolean } {
  let dwellS = 0;
  let unbounded = false;
  mission.items.forEach((it, i) => {
    const p = it.parameters;
    switch (it.action) {
      case PlannerAction.LOITER:
      case PlannerAction.WAIT:
      case PlannerAction.WAYPOINT:
      case PlannerAction.SPLINE_WAYPOINT:
        dwellS += Math.max(0, p.param1 || 0);
        break;
      case PlannerAction.LOITER_TURNS: {
        const r = Math.max(1, Math.abs(p.param3 || 0));
        dwellS += (Math.max(0, p.param1 || 0) * 2 * Math.PI * r) / Math.max(0.1, speeds[i]);
        break;
      }
      case PlannerAction.LOITER_UNLIM:
        unbounded = true;
        break;
    }
  });
  return { dwellS, unbounded };
}

/** Distance, time and altitude statistics for a mission. Pure. */
export function computeMissionMetrics(
  mission: MissionPlan,
  opts: { model?: Partial<FlightModel>; ratedEnduranceS?: number | null } = {}
): MissionMetrics {
  const model = { ...DEFAULT_FLIGHT_MODEL, ...opts.model };
  const cruise = model.cruiseSpeedMs ?? (mission.settings.defaultSpeed > 0 ? mission.settings.defaultSpeed : 10);
  const speeds = speedProfile(mission, cruise);
  const lastSpeed = speeds[speeds.length - 1] ?? cruise;

  const legs: LegMetric[] = missionLegs(mission).map((leg) => {
    const d = haversineM(leg.a, leg.b);
    const v = leg.to ? speeds[leg.to.index] : lastSpeed;
    const dz = leg.altB - leg.altA;
    const tz = dz >= 0 ? dz / model.climbRateMs : -dz / model.descentRateMs;
    return { itemIds: legItemIds(leg), distanceM: d, speedMs: v, timeS: Math.max(trapezoidTime(d, v, model.accelMs2), tz) };
  });

  let takeoffLandS = 0;
  let lastAlt = 0;
  for (const it of mission.items) {
    if (it.action === PlannerAction.TAKEOFF) takeoffLandS += Math.max(0, it.altitude ?? 0) / model.climbRateMs;
    if (it.action === PlannerAction.LAND || it.action === PlannerAction.RTL) {
      takeoffLandS += Math.max(0, lastAlt) / model.descentRateMs;
    }
    if (it.altitude != null && it.action !== PlannerAction.LAND) lastAlt = it.altitude;
  }

  const { dwellS, unbounded } = dwellFor(mission, speeds);
  const legTimeS = legs.reduce((s, l) => s + l.timeS, 0);
  const timeS = legTimeS + dwellS + takeoffLandS;
  const alts = mission.items.filter((i) => i.altitude != null && i.action !== PlannerAction.LAND).map((i) => i.altitude!);
  return {
    distanceM: legs.reduce((s, l) => s + l.distanceM, 0),
    timeS,
    legTimeS,
    dwellS,
    takeoffLandS,
    legs,
    itemCount: mission.items.length,
    spatialCount: legs.length === 0 ? 0 : new Set(legs.flatMap((l) => l.itemIds)).size,
    maxAltM: alts.length ? Math.max(...alts) : 0,
    minAltM: alts.length ? Math.min(...alts) : 0,
    unbounded,
    enduranceFraction: opts.ratedEnduranceS ? timeS / opts.ratedEnduranceS : null,
  };
}

/** mm:ss (or h:mm:ss) formatting for estimates. */
export function formatDurationShort(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
