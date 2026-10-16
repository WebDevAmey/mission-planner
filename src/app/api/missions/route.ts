import { createMissionSchema, listMissionsQuerySchema } from '@/lib/validation/mission';
import { apiError, authorize, readJsonBody, validationError } from '@/lib/http/api';
import { toMissionPlan, toMissionSummary } from '@/lib/missions/map';
import { asDbMission, createMissionWithDocument, listMissions } from '@/lib/missions/repo';
import { templateName, templateWaypoints } from '@/lib/missions/templates';

/** GET /api/missions?query=&sort=updated|name|created&status= → `{ ok, missions: MissionSummary[] }` */
export async function GET(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = listMissionsQuerySchema.safeParse(params);
  if (!parsed.success) return validationError(parsed.error);

  const missions = await listMissions(user.id, parsed.data);
  return Response.json({ ok: true, missions: missions.map(toMissionSummary) });
}

/** POST /api/missions `{ name?, description?, template?, home?, vehicleType? }` → 201 `{ ok, mission }` */
export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, { maxBytes: 16 * 1024, allowEmpty: true });
  if (!body.ok) return body.response;
  const parsed = createMissionSchema.safeParse(body.data ?? {});
  if (!parsed.success) return validationError(parsed.error);
  const { name, description, template, home, vehicleType } = parsed.data;

  let items;
  if (template) {
    if (!templateName(template)) return apiError(400, 'VALIDATION_FAILED', `Unknown template "${template}"`);
    if (!home) return apiError(400, 'VALIDATION_FAILED', 'home: a home position is required to place a template');
    items = templateWaypoints(template, home) ?? [];
  }

  const created = await createMissionWithDocument(user.id, {
    name: name ?? (template && template !== 'blank' ? templateName(template)! : 'Untitled Mission'),
    description,
    vehicleType,
    home: home ?? null,
    items,
  });

  return Response.json({ ok: true, mission: toMissionPlan(asDbMission(created)) }, { status: 201 });
}
