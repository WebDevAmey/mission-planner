import { MAX_MISSION_ITEMS, updateMissionSchema } from '@/lib/validation/mission';
import { apiError, authorize, notFound, readJsonBody, validationError } from '@/lib/http/api';
import { toMissionPlan } from '@/lib/missions/map';
import {
  VersionConflictError,
  asDbMission,
  getOwnedFullMission,
  getOwnedMission,
  saveMissionDocument,
} from '@/lib/missions/repo';
import { db } from '@/prisma/db';

type Ctx = { params: Promise<{ id: string }> };

/** Whole-document saves: 2,000 items plus zones fit comfortably under 4 MB. */
const MAX_PATCH_BYTES = 4 * 1024 * 1024;

/** GET /api/missions/:id → `{ ok, mission: ApiMission }` (404 for missing or foreign). */
export async function GET(request: Request, { params }: Ctx) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const { id } = await params;
  const mission = await getOwnedFullMission(id, user.id);
  if (!mission) return notFound();
  return Response.json({ ok: true, mission: toMissionPlan(asDbMission(mission)) });
}

/**
 * PATCH /api/missions/:id — whole-document save.
 * Body: `{ baseVersion?, name?, description?, homePosition?, settings?, limits?, items?, zones?, vehicleType?, status? }`
 * Responds `{ ok, mission: ApiMission }`; with `Prefer: return=minimal` only
 * `{ ok, mission: { id, version, updatedAt, summary } }`.
 * 400 invalid · 404 not owner · 409 `{ currentVersion }` stale baseVersion · 413 too many items.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const { id } = await params;
  if (!(await getOwnedMission(id, user.id))) return notFound();

  const body = await readJsonBody(request, { maxBytes: MAX_PATCH_BYTES });
  if (!body.ok) return body.response;

  const raw = body.data as { items?: unknown };
  if (Array.isArray(raw?.items) && raw.items.length > MAX_MISSION_ITEMS) {
    return apiError(413, 'PAYLOAD_TOO_LARGE', `A mission can hold at most ${MAX_MISSION_ITEMS} items`);
  }

  const parsed = updateMissionSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  let saved;
  try {
    saved = await saveMissionDocument(id, parsed.data);
  } catch (err) {
    if (err instanceof VersionConflictError) {
      return apiError(409, 'VERSION_CONFLICT', 'This mission was changed elsewhere', {
        currentVersion: err.currentVersion,
      });
    }
    throw err;
  }

  const mission = toMissionPlan(asDbMission(saved));
  if (prefersMinimal(request)) {
    const { id: savedId, version, updatedAt, summary } = mission;
    return Response.json({ ok: true, mission: { id: savedId, version, updatedAt, summary } });
  }
  return Response.json({ ok: true, mission });
}

/** RFC 7240 `Prefer: return=minimal` (autosave only needs the new version). */
function prefersMinimal(request: Request): boolean {
  const prefer = request.headers.get('prefer');
  if (!prefer) return false;
  return prefer
    .toLowerCase()
    .split(/[,;]/)
    .some((token) => token.trim().replace(/\s+/g, '') === 'return=minimal');
}

/** DELETE /api/missions/:id → `{ ok: true }`. Children cascade via FKs. */
export async function DELETE(request: Request, { params }: Ctx) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const { id } = await params;
  if (!(await getOwnedMission(id, user.id))) return notFound();

  await db.orm.public.Mission.where({ id }).delete();
  return Response.json({ ok: true });
}
