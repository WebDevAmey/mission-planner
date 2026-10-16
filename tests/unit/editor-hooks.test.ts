import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import { toEditorMission } from '@/lib/store/editor-types';
import { analyseMissionShared } from '@/hooks/useMissionAnalysis';
import { lookupElevations } from '@/hooks/useTerrainProfile';
import { item, plan } from './fixtures';

describe('analyseMissionShared', () => {
  it('computes once per mission snapshot and terrain profile', () => {
    const m = toEditorMission(plan([item(PlannerAction.TAKEOFF, 47, 8, 30), item(PlannerAction.WAYPOINT, 47.001, 8, 50), item(PlannerAction.RTL)]));
    const a = analyseMissionShared(m, null);
    expect(analyseMissionShared(m, null)).toBe(a);
    const samples = [{ itemIds: [m.items[1].id], aglM: 3 }];
    const b = analyseMissionShared(m, samples);
    expect(b).not.toBe(a);
    expect(analyseMissionShared(m, samples)).toBe(b);
    expect(analyseMissionShared({ ...m }, null)).not.toBe(a);
    expect(analyseMissionShared({ ...m }, null)).toEqual(a);
  });
});

describe('lookupElevations', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('fetches chunks in parallel and keeps point order', async () => {
    let inFlight = 0;
    let peak = 0;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      const { points } = JSON.parse(String(init.body)) as { points: { lat: number }[] };
      return new Response(JSON.stringify({ ok: true, elevations: points.map((p) => p.lat) }));
    });
    const pts = Array.from({ length: 250 }, (_, i) => ({ lat: i, lng: 0 }));
    const els = await lookupElevations(pts, new AbortController().signal);
    expect(els).toEqual(pts.map((p) => p.lat));
    expect(peak).toBe(3);
  });

  it('returns null when any chunk fails and fills single gaps', async () => {
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      const { points } = JSON.parse(String(init.body)) as { points: { lat: number }[] };
      if (points[0].lat >= 100) return new Response('{}', { status: 502 });
      return new Response(JSON.stringify({ elevations: points.map((p) => (p.lat === 1 ? null : p.lat)) }));
    });
    expect(await lookupElevations(Array.from({ length: 150 }, (_, i) => ({ lat: i, lng: 0 })), new AbortController().signal)).toBeNull();
    expect(await lookupElevations([{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 2, lng: 0 }], new AbortController().signal)).toEqual([0, 0, 2]);
  });
});
