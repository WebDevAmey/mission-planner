import { PlannerAction, supportsAltitude } from '@/lib/mavlink/commands';
import type { MissionPlan } from '@/types/mission';
import { hasValidCoords, isSpatial, isTakeoffAtHome } from '@/lib/domain/mission';
import type { Issue, MissionLimits } from './types';

const label = (i: number, name: string) => `Item ${i + 1} (${name})`;

/** Structural checks (former `missionSanityCheck`) plus DO_JUMP target validity. */
export function structureIssues(mission: MissionPlan): Issue[] {
  const items = mission.items;
  const issues: Issue[] = [];
  if (items.length === 0) {
    return [{ code: 'MISSION_EMPTY', severity: 'error', message: 'Mission is empty', itemIds: [] }];
  }
  if (!items.some((i) => i.action === PlannerAction.TAKEOFF)) {
    issues.push({ code: 'NO_TAKEOFF', severity: 'warning', message: 'No TAKEOFF item in mission', itemIds: [] });
  }
  const last = items[items.length - 1];
  if (last.action !== PlannerAction.RTL && last.action !== PlannerAction.LAND) {
    issues.push({
      code: 'NO_TERMINAL',
      severity: 'warning',
      message: 'Mission does not end with RTL or LAND',
      itemIds: [last.id],
    });
  }
  items.forEach((it, i) => {
    if (it.action === PlannerAction.RTL && it !== last) {
      issues.push({
        code: 'RTL_NOT_LAST',
        severity: 'warning',
        message: `${label(i, it.name)}: RTL is not the last item; later items never run`,
        itemIds: [it.id],
      });
    }
  });
  const seen = new Map<number, string[]>();
  for (const it of items) seen.set(it.sequence, [...(seen.get(it.sequence) ?? []), it.id]);
  const dups = [...seen.entries()].filter(([, ids]) => ids.length > 1);
  if (dups.length > 0) {
    issues.push({
      code: 'DUPLICATE_SEQUENCE',
      severity: 'error',
      message: `Duplicate sequence numbers: ${dups.map(([s]) => s).join(', ')}`,
      itemIds: dups.flatMap(([, ids]) => ids),
    });
  }
  items.forEach((it, i) => {
    if (isSpatial(it) && !hasValidCoords(it) && !isTakeoffAtHome(it)) {
      issues.push({
        code: 'MISSING_COORDINATES',
        severity: 'error',
        message: `${label(i, it.name)} has no position (null or 0,0)`,
        itemIds: [it.id],
      });
    }
  });
  items.forEach((it, i) => {
    if (it.action !== PlannerAction.DO_JUMP) return;
    const target = it.parameters.param1;
    const ok = Number.isInteger(target) && target >= 1 && target <= items.length && target !== i + 1;
    if (!ok) {
      issues.push({
        code: 'DO_JUMP_TARGET_INVALID',
        severity: 'error',
        message: `${label(i, it.name)} jumps to item ${target}, which is not a valid other item (1–${items.length})`,
        itemIds: [it.id],
      });
    } else if (it.parameters.param2 < 0) {
      issues.push({
        code: 'DO_JUMP_INFINITE',
        severity: 'warning',
        message: `${label(i, it.name)} repeats forever; the mission will never reach its end`,
        itemIds: [it.id, items[target - 1].id],
      });
    }
  });
  return issues;
}

/** Altitude and speed limits per item. */
export function limitIssues(mission: MissionPlan, limits: MissionLimits): Issue[] {
  const issues: Issue[] = [];
  mission.items.forEach((it, i) => {
    const alt = it.altitude;
    if (alt !== null && supportsAltitude(it.action) && it.action !== PlannerAction.LAND) {
      if (limits.maxAltM != null && alt > limits.maxAltM) {
        issues.push({
          code: 'ALT_ABOVE_MAX',
          severity: 'error',
          message: `${label(i, it.name)} altitude ${alt} m is above the ${limits.maxAltM} m limit`,
          itemIds: [it.id],
        });
      }
      if (limits.minAltM != null && alt < limits.minAltM) {
        issues.push({
          code: 'ALT_BELOW_MIN',
          severity: 'error',
          message: `${label(i, it.name)} altitude ${alt} m is below the ${limits.minAltM} m limit`,
          itemIds: [it.id],
        });
      }
    }
    const speed = it.action === PlannerAction.SET_SPEED ? it.parameters.param2 : it.speed;
    if (limits.maxSpeedMs != null && speed != null && speed > limits.maxSpeedMs) {
      issues.push({
        code: 'SPEED_ABOVE_MAX',
        severity: 'error',
        message: `${label(i, it.name)} speed ${speed} m/s is above the ${limits.maxSpeedMs} m/s limit`,
        itemIds: [it.id],
      });
    }
  });
  return issues;
}
