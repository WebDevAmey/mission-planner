import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => import('./next-headers-mock'));

const graphStream = vi.fn();
vi.mock('@/lib/agents/graph', () => ({
  buildFlightDeckGraph: () => ({ stream: graphStream }),
}));

import { db } from '@/prisma/db';
import { POST as flightDeckPOST } from '@/app/api/flight-deck/route';
import { runAtlas } from '@/lib/agents/atlas-agent';
import { FlightDeckRequestSchema } from '@/lib/agents/schemas';
import { deleteUser, hasDb, makeUser, req, signInAs, type TestUser } from './helpers';

const body = {
  prompt: 'Survey the field',
  settings: { defaultAltitude: 50, defaultSpeed: 10, defaultLoiterTime: 30, defaultWaitTime: 10, altitudeReference: 'relative' },
  constraints: { maxDistanceM: 5000, maxAltM: 120, minAltM: 10, maxSpeedMs: 15, minAGLClearance: 30, defaultSpeedMs: 10 },
  nfzs: [],
  geofences: [],
  homePosition: null,
};

describe('assistant input schema', () => {
  it('bounds list sizes and string lengths', () => {
    const many = Array.from({ length: 201 }, (_, i) => ({ id: `n${i}`, latitude: 1, longitude: 1, radiusM: 10, label: 'x' }));
    expect(FlightDeckRequestSchema.safeParse({ ...body, nfzs: many }).success).toBe(false);
    expect(FlightDeckRequestSchema.safeParse({ ...body, homePosition: { latitude: 91, longitude: 0, altitude: 0 } }).success).toBe(false);
    expect(FlightDeckRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe('assistant configuration errors', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('does not reveal server configuration in production', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    vi.stubEnv('NODE_ENV', 'production');
    const result = await runAtlas({ prompt: 'x', defaultAltitude: 50, defaultSpeed: 10, maxAltM: 120, minAltM: 10 });
    expect(result.error).toBeTruthy();
    expect(JSON.stringify(result)).not.toMatch(/ANTHROPIC|\.env|API key/i);
  });
});

describe.skipIf(!hasDb)('assistant run errors', () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await makeUser();
  });

  afterAll(async () => {
    await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(`user:${user.id}`)).deleteAll();
    await deleteUser(user);
  });

  it('streams a generic error, never the internal exception text', async () => {
    signInAs(user);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    graphStream.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.1.2.3:5432 password=hunter2'));
    const res = await flightDeckPOST(req('POST', '/api/flight-deck', body));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('"type":"done"');
    expect(text).not.toMatch(/hunter2|ECONNREFUSED|10\.1\.2\.3/);
  });

  it('passes an abort signal tied to the request to the graph', async () => {
    signInAs(user);
    graphStream.mockImplementationOnce(async () => (async function* () {})());
    const controller = new AbortController();
    const r = req('POST', '/api/flight-deck', body);
    const res = await flightDeckPOST(new Request(r, { signal: controller.signal }));
    await res.text();
    const options = graphStream.mock.lastCall?.[1] as { signal: AbortSignal };
    controller.abort();
    expect(options.signal.aborted).toBe(true);
  });
});
