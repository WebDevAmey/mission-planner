import { MISSION_TEMPLATES, instantiateTemplate } from '@/lib/templates/mission-templates';
import type { WaypointInput } from '@/lib/missions/repo';
import { DEFAULT_SETTINGS } from '@/lib/missions/map';

/** Server-side template instantiation for POST /api/missions `{ template, home }`. */
export function templateWaypoints(
  templateId: string,
  home: { latitude: number; longitude: number }
): WaypointInput[] | null {
  const template = MISSION_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return null;
  return instantiateTemplate(template, home.latitude, home.longitude, DEFAULT_SETTINGS).map((item, i) => ({
    sequence: i,
    action: item.action as WaypointInput['action'],
    command: item.command,
    frame: item.frame,
    name: item.name,
    latitude: item.latitude,
    longitude: item.longitude,
    altitude: item.altitude,
    speed: item.speed ?? null,
    notes: item.notes ?? null,
    param1: item.parameters.param1 ?? 0,
    param2: item.parameters.param2 ?? 0,
    param3: item.parameters.param3 ?? 0,
    param4: item.parameters.param4 ?? 0,
    param5: item.parameters.param5 ?? 0,
    param6: item.parameters.param6 ?? 0,
    param7: item.parameters.param7 ?? 0,
  }));
}

export function templateName(templateId: string): string | null {
  return MISSION_TEMPLATES.find((t) => t.id === templateId)?.name ?? null;
}
