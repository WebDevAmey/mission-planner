/**
 * Development-only seed data: one verified test user with a sample mission.
 * Not run automatically — invoke explicitly with `pnpm db:seed`. Safe to run
 * repeatedly (upserts the user by email, replaces its seed mission).
 *
 * Never run this against a production database.
 */
import { db } from './db';
import { hashPassword } from '../lib/auth/password';

const SEED_EMAIL = 'demo@example.com';
const SEED_PASSWORD = 'password1234';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run the seed script with NODE_ENV=production.');
  }

  const passwordHash = await hashPassword(SEED_PASSWORD);

  let user = await db.orm.public.User.where((u) => u.email.eq(SEED_EMAIL)).first();
  if (!user) {
    user = await db.orm.public.User.create({
      email: SEED_EMAIL,
      passwordHash,
      name: 'Demo Operator',
      emailVerified: new Date().toISOString(),
    });
    console.log(`Created demo user ${SEED_EMAIL} / ${SEED_PASSWORD}`);
  } else {
    console.log(`Demo user ${SEED_EMAIL} already exists — reusing it.`);
  }

  // Waypoints and settings cascade-delete with the mission (ON DELETE CASCADE).
  await db.orm.public.Mission.where({ userId: user.id }).deleteAll();

  const mission = await db.orm.public.Mission.create({
    name: 'Demo Survey Route',
    description: 'Seed data — a short three-waypoint survey route.',
    userId: user.id,
    homeLatitude: 37.4219,
    homeLongitude: -122.084,
    homeAltitude: 10,
  });

  await db.orm.public.MissionSettings.create({ missionId: mission.id });

  const waypoints: Array<{
    sequence: number;
    action: 'takeoff' | 'waypoint' | 'rtl';
    command: number;
    frame: number;
    name: string;
    latitude: number | null;
    longitude: number | null;
    altitude: number | null;
  }> = [
    { sequence: 0, action: 'takeoff', command: 22, frame: 3, name: 'TAKEOFF', latitude: 37.4219, longitude: -122.084, altitude: 30 },
    { sequence: 1, action: 'waypoint', command: 16, frame: 3, name: 'WP 1', latitude: 37.4225, longitude: -122.0835, altitude: 50 },
    { sequence: 2, action: 'waypoint', command: 16, frame: 3, name: 'WP 2', latitude: 37.423, longitude: -122.082, altitude: 50 },
    { sequence: 3, action: 'rtl', command: 20, frame: 3, name: 'RETURN_TO_LAUNCH', latitude: null, longitude: null, altitude: null },
  ];

  for (const wp of waypoints) {
    await db.orm.public.Waypoint.create({
      missionId: mission.id,
      sequence: wp.sequence,
      action: wp.action,
      command: wp.command,
      frame: wp.frame,
      name: wp.name,
      latitude: wp.latitude,
      longitude: wp.longitude,
      altitude: wp.altitude,
      param1: 0,
      param2: 0,
      param3: 0,
      param4: 0,
      param5: 0,
      param6: 0,
      param7: 0,
    });
  }

  console.log(`Seeded mission "${mission.name}" (${waypoints.length} waypoints) for ${SEED_EMAIL}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.close();
  });
