import { z } from 'zod';
import { exportMissionFile, type ExportFormat } from '@/lib/domain/export';
import type { VehicleType } from '@/lib/domain/export';
import { apiError, authorize, notFound, validationError } from '@/lib/http/api';
import { toMissionPlan } from '@/lib/missions/map';
import { asDbMission, getOwnedFullMission } from '@/lib/missions/repo';
import { analyseMission, domainZones } from '@/lib/missions/domain';

/** `json` is the public name of the app's own re-importable format (`mps` in the domain layer). */
const querySchema = z.object({
  format: z.enum(['plan', 'waypoints', 'kml', 'geojson', 'csv', 'json']),
  force: z.enum(['0', '1', 'true', 'false']).optional(),
});

/** Formats a vehicle flies; these refuse to export a mission with validation errors unless forced. */
const FLIGHT_FORMATS = new Set<ExportFormat>(['plan', 'waypoints']);

const VEHICLE_TYPES = new Set<VehicleType>(['multirotor', 'fixed_wing', 'vtol', 'rover']);

/**
 * GET /api/missions/:id/export?format=plan|waypoints|kml|geojson|csv|json[&force=1]
 * → the file, with Content-Type and `Content-Disposition: attachment; filename="<slug>_<utc>.<ext>"`.
 * 400 unknown format · 404 not owner · 422 `{ validationIssues }` for .plan/.waypoints with errors (unless force=1).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const format: ExportFormat = parsed.data.format === 'json' ? 'mps' : parsed.data.format;
  const force = parsed.data.force === '1' || parsed.data.force === 'true';

  const { id } = await params;
  const row = await getOwnedFullMission(id, user.id);
  if (!row) return notFound();
  const mission = toMissionPlan(asDbMission(row));

  if (FLIGHT_FORMATS.has(format) && !force) {
    const errors = analyseMission(mission).issues.filter((i) => i.severity === 'error');
    if (errors.length) {
      return apiError(
        422,
        'UNPROCESSABLE',
        `Mission has ${errors.length} validation ${errors.length === 1 ? 'error' : 'errors'}. Fix them or export with force=1.`,
        { validationIssues: errors }
      );
    }
  }

  const vehicleType = VEHICLE_TYPES.has(mission.vehicleType as VehicleType)
    ? (mission.vehicleType as VehicleType)
    : 'multirotor';
  const file = exportMissionFile(mission, format, {
    zones: domainZones(mission),
    vehicleType,
    cruiseSpeed: mission.settings.cruiseSpeed,
    hoverSpeed: mission.settings.hoverSpeed,
    constraints: mission.limits,
  });

  return new Response(file.content, {
    status: 200,
    headers: {
      'Content-Type': `${file.mimeType}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
