import {
  NON_AUTOCONTINUE_ACTIONS,
  buildMissionList,
  resequenceMissionItems,
} from '@/lib/domain/items';
import {
  getMissionCommandDefinition,
  supportsCoordinates,
  PlannerAction as PA,
  FRAME_NAMES,
  COMMAND_NAMES,
  COMMAND_SHORT_LABELS,
} from '@/lib/mavlink/commands';
import type { MissionExportPayload, MissionPlan, SanityWarning } from '@/types/mission';
import { round7, round1, haversineDistance } from '@/lib/utils';
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

export const missionSanityCheck = (mission: MissionPlan): SanityWarning[] => {
  const warnings: SanityWarning[] = [];
  const items = mission.items;

  if (items.length === 0) {
    warnings.push({ message: 'Mission is empty', severity: 'error' });
    return warnings;
  }

  const hasTakeoff = items.some((i) => i.action === PA.TAKEOFF);
  if (!hasTakeoff) {
    warnings.push({ message: 'No TAKEOFF item in mission', severity: 'warning' });
  }

  const lastSpatial = [...items]
    .reverse()
    .find((i) => supportsCoordinates(i.action));
  const lastItem = items[items.length - 1];

  if (
    lastItem &&
    lastItem.action !== PA.RTL &&
    lastItem.action !== PA.LAND
  ) {
    warnings.push({
      seq: lastItem.sequence,
      message: 'Mission does not end with RTL or LAND',
      severity: 'warning',
    });
  }

  const rtlItems = items.filter((i) => i.action === PA.RTL);
  for (const item of rtlItems) {
    if (item !== lastItem) {
      warnings.push({
        seq: item.sequence,
        message: `RTL at seq ${item.sequence} is not the last item`,
        severity: 'warning',
      });
    }
  }

  const seqs = items.map((i) => i.sequence);
  const dupSeqs = seqs.filter((s, idx) => seqs.indexOf(s) !== idx);
  if (dupSeqs.length > 0) {
    warnings.push({
      message: `Duplicate sequence numbers: ${[...new Set(dupSeqs)].join(', ')}`,
      severity: 'error',
    });
  }

  const zeroCoordsItems = items.filter(
    (i) =>
      supportsCoordinates(i.action) &&
      (i.latitude === null || i.longitude === null || (i.latitude === 0 && i.longitude === 0))
  );
  for (const item of zeroCoordsItems) {
    warnings.push({
      seq: item.sequence,
      message: `Item ${item.sequence + 1} (${item.name}) has null or zero coordinates`,
      severity: 'warning',
    });
  }

  void lastSpatial;
  return warnings;
};

export const totalMissionDistance = (mission: MissionPlan): number => {
  const spatialItems = mission.items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  );
  let total = 0;
  for (let i = 1; i < spatialItems.length; i++) {
    const a = spatialItems[i - 1];
    const b = spatialItems[i];
    total += haversineDistance(
      a.latitude!,
      a.longitude!,
      b.latitude!,
      b.longitude!
    );
  }
  return total;
};

export const estimatedFlightTime = (
  mission: MissionPlan,
  defaultSpeedMs: number
): number => {
  const dist = totalMissionDistance(mission);
  return dist / (defaultSpeedMs > 0 ? defaultSpeedMs : 10);
};

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

export const exportMissionAsPlan = (mission: MissionPlan): string => {
  const items = buildMissionList(mission);
  const home = mission.homePosition;
  const firstSpatial = items.find((i) => i.latitude !== null && i.longitude !== null);
  const plannedHome = home
    ? [round7(home.latitude), round7(home.longitude), round1(home.altitude)]
    : firstSpatial
    ? [firstSpatial.param5, firstSpatial.param6, firstSpatial.param7]
    : [0, 0, 0];

  return JSON.stringify(
    {
      fileType: 'Plan',
      geoFence: { circles: [], polygons: [], version: 2 },
      groundStation: 'MPS Offline Mission Planner',
      mission: {
        cruiseSpeed: mission.settings.defaultSpeed,
        firmwareType: 12,
        globalPlanAltitudeMode: 1,
        hoverSpeed: mission.settings.defaultSpeed,
        items: items.map((item) => ({
          type: 'SimpleItem',
          command: item.command,
          frame: item.frame,
          autoContinue: item.autocontinue === 1,
          doJumpId: item.seq + 1,
          Altitude: item.param7,
          AltitudeMode: 1,
          AMSLAltAboveTerrain: null,
          params: [
            item.param1 ?? 0,
            item.param2 ?? 0,
            item.param3 ?? 0,
            item.param4 ?? 0,
            item.param5 ?? 0,
            item.param6 ?? 0,
            item.param7 ?? 0,
          ],
        })),
        plannedHomePosition: plannedHome,
        vehicleType: 2,
        version: 2,
      },
      rallyPoints: { points: [], version: 2 },
      version: 1,
    },
    null,
    2
  );
};

export const exportMissionAsWpl = (mission: MissionPlan): string => {
  const items = buildMissionList(mission);
  const home = mission.homePosition;
  const firstSpatial = items.find((i) => i.latitude !== null && i.longitude !== null);

  const homeLat = home ? round7(home.latitude) : firstSpatial ? firstSpatial.param5 : 0;
  const homeLng = home ? round7(home.longitude) : firstSpatial ? firstSpatial.param6 : 0;
  const homeAlt = home ? round1(home.altitude) : firstSpatial ? firstSpatial.param7 : 0;

  const homeRow = [0, 1, 0, 16, 0, 0, 0, 0, homeLat, homeLng, homeAlt, 1].join('\t');

  const missionRows = items.map((item) =>
    [
      item.seq + 1,
      0,
      item.frame,
      item.command,
      item.param1 ?? 0,
      item.param2 ?? 0,
      item.param3 ?? 0,
      item.param4 ?? 0,
      item.param5 ?? 0,
      item.param6 ?? 0,
      item.param7 ?? 0,
      item.autocontinue,
    ].join('\t')
  );

  return ['QGC WPL 110', homeRow, ...missionRows].join('\n');
};

export const exportMission = (
  mission: MissionPlan,
  format: MissionExportFormat
): MissionExportPayload => {
  switch (format) {
    case 'json':
      return {
        content: exportMissionAsJson(mission),
        extension: 'json',
        mimeType: 'application/json',
      };
    case 'plan':
      return {
        content: exportMissionAsPlan(mission),
        extension: 'plan',
        mimeType: 'application/json',
      };
    case 'wpl':
      return {
        content: exportMissionAsWpl(mission),
        extension: 'waypoints',
        mimeType: 'text/plain',
      };
  }
};

export interface V1ExportOptions {
  tenantId: string;
  tenantName: string;
  constraints: ConstraintConfig & { nfzs: NoFlyZone[] };
  metrics: MissionMetrics | null;
  geofences?: GeofenceItem[];
}

export const exportMissionAsV1Json = (
  mission: MissionPlan,
  opts: V1ExportOptions
): string => {
  const resequenced = resequenceMissionItems(mission.items, mission.settings);
  let seq = 0;
  const exportItems = resequenced.map((item) => {
    const def = getMissionCommandDefinition(item.action);
    const isSpatial = def.supportsCoordinates;
    const x = isSpatial ? round7(item.latitude ?? 0) : 0;
    const y = isSpatial ? round7(item.longitude ?? 0) : 0;
    const z = def.supportsAltitude ? round1(item.altitude ?? 0) : 0;
    const frameNum = item.frame as number;
    const cmdNum = item.command as number;

    const exportItem = {
      seq: seq++,
      command: {
        id: cmdNum,
        name: COMMAND_NAMES[cmdNum] ?? `CMD_${cmdNum}`,
        label: COMMAND_SHORT_LABELS[cmdNum] ?? item.name,
      },
      frame: FRAME_NAMES[frameNum] ?? `FRAME_${frameNum}`,
      current: 0,
      autocontinue: NON_AUTOCONTINUE_ACTIONS.has(item.action) ? 0 : 1,
      param1: item.parameters.param1 ?? 0,
      param2: item.parameters.param2 ?? 0,
      param3: item.parameters.param3 ?? 0,
      param4: item.parameters.param4 ?? 0,
      param5: x,
      param6: y,
      param7: z,
      x,
      y,
      z,
      speed_ms: def.supportsSpeed ? (item.speed ?? null) : null,
    };

    return exportItem;
  });

  const home = mission.homePosition;

  return JSON.stringify(
    {
      fileType: 'MissionPlannerMission',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tenantId: opts.tenantId,
      tenantName: opts.tenantName,
      missionId: mission.id,
      missionName: mission.name,
      home: home
        ? { lat: round7(home.latitude), lng: round7(home.longitude), alt: round1(home.altitude) }
        : { lat: 0, lng: 0, alt: 0 },
      constraints: opts.constraints,
      metrics: opts.metrics ?? {},
      geofences: opts.geofences ?? [],
      items: exportItems,
    },
    null,
    2
  );
};

export function makeExportFilename(missionName: string): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, '0');
  const datePart =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `${missionName.replace(/\s+/g, '_')}_${datePart}.json`;
}
