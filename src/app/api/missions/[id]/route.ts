import { db } from '@/prisma/db';
import { requireUser, UnauthorizedError } from '@/lib/auth/guard';
import { updateMissionSchema } from '@/lib/validation/mission';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { toMissionPlan } from '@/lib/missions/map';
import { toIsoString } from '@/lib/db/serialize';

async function loadFullMission(id: string) {
  return db.orm.public.Mission.where({ id })
    .include('waypoints', (w) => w)
    .include('settings', (s) => s)
    .first();
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const { id } = await params;
  const mission = await loadFullMission(id);

  // 404, not 403, for a mission that exists but isn't yours — don't confirm it exists.
  if (!mission || mission.userId !== user.id) {
    return Response.json({ ok: false, error: 'Mission not found' }, { status: 404 });
  }

  return Response.json({ ok: true, mission: toMissionPlan(mission) });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const existing = await db.orm.public.Mission.where({ id }).first();
  if (!existing || existing.userId !== user.id) {
    return Response.json({ ok: false, error: 'Mission not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = updateMissionSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { name, description, homePosition, settings, items } = parsed.data;

  await db.transaction(async (tx) => {
    const missionUpdate: Record<string, unknown> = { updatedAt: toIsoString(new Date()) };
    if (name !== undefined) missionUpdate.name = name;
    if (description !== undefined) missionUpdate.description = description;
    if (homePosition !== undefined) {
      missionUpdate.homeLatitude = homePosition?.latitude ?? null;
      missionUpdate.homeLongitude = homePosition?.longitude ?? null;
      missionUpdate.homeAltitude = homePosition?.altitude ?? null;
    }
    await tx.orm.public.Mission.where({ id }).update(missionUpdate);

    if (settings) {
      await tx.orm.public.MissionSettings.where({ missionId: id }).upsert({
        create: { missionId: id, ...settings },
        update: settings,
      });
    }

    if (items) {
      await tx.orm.public.Waypoint.where({ missionId: id }).deleteAll();
      for (const item of items) {
        await tx.orm.public.Waypoint.create({
          ...(item.id ? { id: item.id } : {}),
          missionId: id,
          sequence: item.sequence,
          action: item.action,
          command: item.command,
          frame: item.frame,
          name: item.name,
          latitude: item.latitude,
          longitude: item.longitude,
          altitude: item.altitude,
          speed: item.speed ?? null,
          notes: item.notes ?? null,
          param1: item.param1,
          param2: item.param2,
          param3: item.param3,
          param4: item.param4,
          param5: item.param5,
          param6: item.param6,
          param7: item.param7,
        });
      }
    }
  });

  const full = await loadFullMission(id);
  return Response.json({ ok: true, mission: toMissionPlan(full!) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (err) {
    if (err instanceof UnauthorizedError) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    throw err;
  }

  const { id } = await params;
  const existing = await db.orm.public.Mission.where({ id }).first();
  if (!existing || existing.userId !== user.id) {
    return Response.json({ ok: false, error: 'Mission not found' }, { status: 404 });
  }

  // Waypoints and settings cascade via the FK's ON DELETE CASCADE.
  await db.orm.public.Mission.where({ id }).delete();

  return Response.json({ ok: true });
}
