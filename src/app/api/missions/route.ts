import { db } from '@/prisma/db';
import { requireUser, UnauthorizedError } from '@/lib/auth/guard';
import { createMissionSchema } from '@/lib/validation/mission';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { toMissionPlan, toMissionSummary } from '@/lib/missions/map';

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const missions = await db.orm.public.Mission.where({ userId: user.id })
    .orderBy((m) => m.updatedAt.desc())
    .include('waypoints', (w) => w.select('id'))
    .all();

  return Response.json({ ok: true, missions: missions.map(toMissionSummary) });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = createMissionSchema.safeParse(body ?? {});
  const name = parsed.success ? parsed.data.name : 'Untitled Mission';

  const mission = await db.orm.public.Mission.create({ name, userId: user.id });
  await db.orm.public.MissionSettings.create({ missionId: mission.id });

  const full = await db.orm.public.Mission.where({ id: mission.id })
    .include('waypoints', (w) => w)
    .include('settings', (s) => s)
    .first();

  return Response.json({ ok: true, mission: toMissionPlan(full!) }, { status: 201 });
}
