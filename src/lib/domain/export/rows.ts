import { getMissionCommandDefinition, PlannerAction } from '@/lib/mavlink/commands';
import { buildMissionList, resequenceMissionItems } from '@/lib/domain/items';
import type { BuiltMissionItem, MissionPlan } from '@/types/mission';

/**
 * Wire rows for export (DO_CHANGE_SPEED rows are inserted before items with a speed,
 * as in `buildMissionList`). DO_JUMP param1, a 1-based editor item index, is rewritten
 * to the 1-based wire sequence (home = 0) of the target's first row.
 */
export function buildExportRows(mission: MissionPlan): BuiltMissionItem[] {
  const rows = buildMissionList(mission);
  const items = resequenceMissionItems(mission.items, mission.settings);
  const firstRow: number[] = [];
  let r = 0;
  for (const it of items) {
    firstRow.push(r);
    const hasSpeed = getMissionCommandDefinition(it.action).supportsSpeed && (it.speed ?? 0) > 0;
    r += hasSpeed ? 2 : 1;
  }
  return rows.map((row) => {
    if (row.action !== PlannerAction.DO_JUMP) return row;
    const target = firstRow[Math.round(row.param1) - 1];
    return target === undefined ? row : { ...row, param1: target + 1 };
  });
}

export const isNavRow = (row: BuiltMissionItem) => row.latitude !== null && row.longitude !== null;
