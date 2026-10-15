import { createMissionItem } from '@/lib/services/mission-builder';
import { PlannerAction } from '@/lib/mavlink/commands';
import type { MissionItem, MissionPlan, MissionPlanSettings } from '@/types/mission';

export const SETTINGS: MissionPlanSettings = {
  defaultAltitude: 50,
  defaultSpeed: 10,
  defaultLoiterTime: 30,
  defaultWaitTime: 10,
  altitudeReference: 'relative',
};

let n = 0;
export function item(
  action: PlannerAction,
  lat?: number,
  lng?: number,
  alt?: number,
  extra: Partial<MissionItem> = {}
): MissionItem {
  const it = createMissionItem(action, 0, SETTINGS, { latitude: lat, longitude: lng, altitude: alt });
  return { ...it, id: extra.id ?? `i${++n}`, ...extra, parameters: { ...it.parameters, ...extra.parameters } };
}

export function plan(items: MissionItem[], extra: Partial<MissionPlan> = {}): MissionPlan {
  return {
    id: 'm1',
    name: 'Test mission',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: items.map((it, i) => ({ ...it, sequence: i })),
    settings: SETTINGS,
    homePosition: { latitude: 47.0, longitude: 8.0, altitude: 0 },
    ...extra,
  };
}

/** A small square-ish mission near (47, 8). */
export function sampleMission(): MissionPlan {
  return plan([
    item(PlannerAction.TAKEOFF, 47.0, 8.0, 30),
    item(PlannerAction.WAYPOINT, 47.001, 8.0, 50),
    item(PlannerAction.WAYPOINT, 47.001, 8.0015, 50),
    item(PlannerAction.WAYPOINT, 47.0, 8.0015, 50),
    item(PlannerAction.RTL),
  ]);
}
