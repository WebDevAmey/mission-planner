import type { MissionPlan } from '@/types/mission';
import { plannedHome } from './qgc-plan';
import { buildExportRows } from './rows';

/**
 * `QGC WPL 110` text (Mission Planner / MAVProxy). Row 0 is home (frame 0, NAV_WAYPOINT,
 * current = 1). Columns: seq, current, frame, command, p1..p4, lat, lon, alt, autocontinue.
 * Uses CRLF line endings for Windows tools.
 */
export function buildWaypointsFile(mission: MissionPlan): string {
  const [lat, lng, alt] = plannedHome(mission);
  const home = [0, 1, 0, 16, 0, 0, 0, 0, lat, lng, alt, 1].join('\t');
  const rows = buildExportRows(mission).map((r) =>
    [r.seq + 1, 0, r.frame, r.command, r.param1, r.param2, r.param3, r.param4, r.param5, r.param6, r.param7, r.autocontinue].join('\t')
  );
  return ['QGC WPL 110', home, ...rows].join('\r\n') + '\r\n';
}
