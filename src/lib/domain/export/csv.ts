import { COMMAND_NAMES } from '@/lib/mavlink/commands';
import type { MissionPlan } from '@/types/mission';

const cell = (v: unknown): string => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const CSV_HEADER = ['seq', 'command', 'lat', 'lon', 'alt_rel_m', 'speed_ms', 'param1', 'param2', 'param3', 'param4', 'notes'];

/** One row per editor item, for spreadsheet review. */
export function buildCsv(mission: MissionPlan): string {
  const rows = mission.items.map((it, i) => [
    i + 1,
    COMMAND_NAMES[it.command] ?? it.command,
    it.latitude,
    it.longitude,
    it.altitude,
    it.speed ?? null,
    it.parameters.param1,
    it.parameters.param2,
    it.parameters.param3,
    it.parameters.param4,
    it.notes ?? '',
  ]);
  return [CSV_HEADER, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
