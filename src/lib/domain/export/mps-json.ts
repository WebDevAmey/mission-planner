import {
  COMMAND_NAMES,
  COMMAND_SHORT_LABELS,
  FRAME_NAMES,
  getMissionCommandDefinition,
} from '@/lib/mavlink/commands';
import { round1, round7 } from '@/lib/utils';
import { NON_AUTOCONTINUE_ACTIONS, resequenceMissionItems } from '@/lib/domain/items';
import type { Zone } from '@/lib/domain/zones';
import type { MissionPlan } from '@/types/mission';

export interface MpsJsonOptions {
  tenantId?: string;
  tenantName?: string;
  constraints?: unknown;
  metrics?: unknown;
  /** Legacy geofence-store items (v1.0 field). */
  geofences?: unknown[];
  /** Server zones; when given the file is written as version 1.1. */
  zones?: Zone[];
  now?: Date;
}

/** The app's own re-importable JSON format ("MissionPlannerMission" v1.0 / v1.1). */
export function buildMpsJson(mission: MissionPlan, opts: MpsJsonOptions = {}): string {
  const items = resequenceMissionItems(mission.items, mission.settings).map((item, seq) => {
    const def = getMissionCommandDefinition(item.action);
    const x = def.supportsCoordinates ? round7(item.latitude ?? 0) : 0;
    const y = def.supportsCoordinates ? round7(item.longitude ?? 0) : 0;
    const z = def.supportsAltitude ? round1(item.altitude ?? 0) : 0;
    return {
      seq,
      id: item.id,
      command: {
        id: item.command as number,
        name: COMMAND_NAMES[item.command] ?? `CMD_${item.command}`,
        label: COMMAND_SHORT_LABELS[item.command] ?? item.name,
      },
      action: item.action,
      frame: FRAME_NAMES[item.frame] ?? `FRAME_${item.frame}`,
      frameId: item.frame as number,
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
      notes: item.notes ?? null,
    };
  });
  const home = mission.homePosition;
  const withZones = opts.zones !== undefined;
  return JSON.stringify(
    {
      fileType: 'MissionPlannerMission',
      version: withZones ? '1.1' : '1.0',
      exportedAt: (opts.now ?? new Date()).toISOString(),
      tenantId: opts.tenantId ?? null,
      tenantName: opts.tenantName ?? null,
      missionId: mission.id,
      missionName: mission.name,
      description: mission.description ?? null,
      home: home
        ? { lat: round7(home.latitude), lng: round7(home.longitude), alt: round1(home.altitude) }
        : { lat: 0, lng: 0, alt: 0 },
      settings: mission.settings,
      constraints: opts.constraints ?? null,
      metrics: opts.metrics ?? {},
      geofences: opts.geofences ?? [],
      ...(withZones ? { zones: opts.zones } : {}),
      items,
    },
    null,
    2
  );
}
