import { db } from '@/prisma/db';
import { requireUser, UnauthorizedError } from '@/lib/auth/guard';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { toMissionPlan } from '@/lib/missions/map';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  const original = await db.orm.public.Mission.where({ id })
    .include('waypoints', (w) => w)
    .include('settings', (s) => s)
    .first();

  if (!original || original.userId !== user.id) {
    return Response.json({ ok: false, error: 'Mission not found' }, { status: 404 });
  }

  const copy = await db.transaction(async (tx) => {
    const mission = await tx.orm.public.Mission.create({
      name: `${original.name} (Copy)`,
      description: original.description,
      userId: user.id,
      homeLatitude: original.homeLatitude,
      homeLongitude: original.homeLongitude,
      homeAltitude: original.homeAltitude,
    });

    const settings = original.settings;
    await tx.orm.public.MissionSettings.create({
      missionId: mission.id,
      ...(settings
        ? {
            defaultAltitude: settings.defaultAltitude,
            defaultSpeed: settings.defaultSpeed,
            defaultLoiterTime: settings.defaultLoiterTime,
            defaultWaitTime: settings.defaultWaitTime,
            altitudeReference: settings.altitudeReference,
            maxDistanceM: settings.maxDistanceM,
            maxAltM: settings.maxAltM,
            minAltM: settings.minAltM,
            maxSpeedMs: settings.maxSpeedMs,
            minAGLClearance: settings.minAGLClearance,
          }
        : {}),
    });

    for (const wp of original.waypoints) {
      await tx.orm.public.Waypoint.create({
        missionId: mission.id,
        sequence: wp.sequence,
        action: wp.action,
        command: wp.command,
        frame: wp.frame,
        name: wp.name,
        latitude: wp.latitude,
        longitude: wp.longitude,
        altitude: wp.altitude,
        speed: wp.speed,
        notes: wp.notes,
        param1: wp.param1,
        param2: wp.param2,
        param3: wp.param3,
        param4: wp.param4,
        param5: wp.param5,
        param6: wp.param6,
        param7: wp.param7,
      });
    }

    return mission;
  });

  const full = await db.orm.public.Mission.where({ id: copy.id })
    .include('waypoints', (w) => w)
    .include('settings', (s) => s)
    .first();

  return Response.json({ ok: true, mission: toMissionPlan(full!) }, { status: 201 });
}
