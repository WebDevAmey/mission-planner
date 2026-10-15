import { buildMissionList } from '@/lib/domain/items';
import { computeMissionMetrics } from '@/lib/domain/metrics';
import { structureIssues } from '@/lib/domain/validate';
import { zonesFromLegacy, type Zone } from '@/lib/domain/zones';
import {
  buildMpsJson,
  buildQgcPlan,
  buildWaypointsFile,
  slugFilename,
  type PlanExportOptions,
} from '@/lib/domain/export';
import type { MissionExportPayload, MissionPlan, SanityWarning } from '@/types/mission';
import type { ConstraintConfig, NoFlyZone } from '@/lib/store/constraints-store';
import type { GeofenceItem } from '@/lib/store/geofence-store';
import type { MissionMetrics } from '@/lib/services/metrics-service';

export type MissionExportFormat = 'json' | 'plan' | 'wpl';

export {
  normalizeMissionItem,
  createMissionItem,
  resequenceMissionItems,
  buildMissionList,
} from '@/lib/domain/items';

/** Structural checks; legacy adapter over `structureIssues` (`@/lib/domain/validate`). */
export const missionSanityCheck = (mission: MissionPlan): SanityWarning[] => {
  const seqOf = new Map(mission.items.map((i) => [i.id, i.sequence]));
  return structureIssues(mission).map((issue) => ({
    seq: issue.itemIds.length === 1 ? seqOf.get(issue.itemIds[0]) : undefined,
    message: issue.message,
    severity: issue.severity,
  }));
};

/** Route length incl. home -> first item and the RTL return leg. */
export const totalMissionDistance = (mission: MissionPlan): number =>
  computeMissionMetrics(mission).distanceM;

/** Estimated flight time (s) with the trapezoidal model from `@/lib/domain/metrics`. */
export const estimatedFlightTime = (mission: MissionPlan, defaultSpeedMs: number): number =>
  computeMissionMetrics(mission, { model: { cruiseSpeedMs: defaultSpeedMs > 0 ? defaultSpeedMs : 10 } }).timeS;

export const exportMissionAsJson = (mission: MissionPlan): string =>
  JSON.stringify(
    {
      planner: 'MPS Offline Mission Planner',
      exportedAt: new Date().toISOString(),
      mission: {
        id: mission.id,
        name: mission.name,
        createdAt: mission.createdAt,
        updatedAt: mission.updatedAt,
        settings: mission.settings,
        homePosition: mission.homePosition ?? null,
      },
      items: buildMissionList(mission),
    },
    null,
    2
  );

/** QGroundControl `.plan` for ArduPilot (firmwareType 3). */
export const exportMissionAsPlan = (mission: MissionPlan, opts: PlanExportOptions = {}): string =>
  buildQgcPlan(mission, opts);

/** `QGC WPL 110` waypoints file. */
export const exportMissionAsWpl = (mission: MissionPlan): string => buildWaypointsFile(mission);

export const exportMission = (
  mission: MissionPlan,
  format: MissionExportFormat,
  opts: PlanExportOptions = {}
): MissionExportPayload => {
  switch (format) {
    case 'json':
      return { content: exportMissionAsJson(mission), extension: 'json', mimeType: 'application/json' };
    case 'plan':
      return { content: exportMissionAsPlan(mission, opts), extension: 'plan', mimeType: 'application/json' };
    case 'wpl':
      return { content: exportMissionAsWpl(mission), extension: 'waypoints', mimeType: 'text/plain' };
  }
};

export interface V1ExportOptions {
  tenantId: string;
  tenantName: string;
  constraints: ConstraintConfig & { nfzs: NoFlyZone[] };
  metrics: MissionMetrics | null;
  geofences?: GeofenceItem[];
  /** Server zones; when given the file is written as version 1.1. */
  zones?: Zone[];
}

/** MPS JSON (v1.0, or v1.1 with zones). Adapter over `buildMpsJson`. */
export const exportMissionAsV1Json = (mission: MissionPlan, opts: V1ExportOptions): string =>
  buildMpsJson(mission, {
    tenantId: opts.tenantId,
    tenantName: opts.tenantName,
    constraints: opts.constraints,
    metrics: opts.metrics,
    geofences: opts.geofences ?? [],
    zones: opts.zones,
  });

/** Legacy zones from the browser stores, for callers not yet on server zones. */
export const legacyZones = (nfzs: NoFlyZone[], geofences: GeofenceItem[] = []): Zone[] =>
  zonesFromLegacy(nfzs, geofences);

export function makeExportFilename(missionName: string, ext = 'json'): string {
  return slugFilename(missionName, ext);
}
