import { beforeEach, describe, expect, it } from 'vitest';
import { PlannerAction } from '@/lib/mavlink/commands';
import { resequenceMissionItems } from '@/lib/services/mission-builder';
import { resequenceStable, useMissionStore } from '@/lib/store/mission-store';
import { SETTINGS, item, plan } from './fixtures';

function load(n = 50) {
  const items = [item(PlannerAction.TAKEOFF, 47, 8, 30)];
  for (let i = 1; i < n; i++) items.push(item(PlannerAction.WAYPOINT, 47 + i * 0.0001, 8 + (i % 7) * 0.0001, 50));
  items.push(item(PlannerAction.RTL));
  useMissionStore.getState().loadMission(plan(items));
  return useMissionStore.getState().mission!;
}

describe('mission store structural sharing', () => {
  beforeEach(() => useMissionStore.setState({ mission: null, past: [], future: [] }));

  it('editing one item keeps every other item, zone list and settings object', () => {
    const before = load();
    const target = before.items[10];
    useMissionStore.getState().updateMissionItem(target.id, { latitude: 47.5 });
    const after = useMissionStore.getState().mission!;
    expect(after.items[10]).not.toBe(target);
    expect(after.items[10].latitude).toBe(47.5);
    after.items.forEach((it, i) => {
      if (i !== 10) expect(it).toBe(before.items[i]);
    });
    expect(after.zones).toBe(before.zones);
    expect(after.settings).toBe(before.settings);
  });

  it('history entries are unaffected by later edits; undo/redo restore them', () => {
    const v0 = load();
    const snapshot = JSON.stringify(v0);
    const s = useMissionStore.getState();
    s.updateMissionItem(v0.items[3].id, { altitude: 99 });
    s.deleteMissionItem(v0.items[5].id);
    s.reorderMissionItems(1, 4);
    s.addZone({ kind: 'no_fly', shape: 'circle', label: 'z', enabled: true, centerLat: 47, centerLng: 8, radiusM: 30, vertices: null, minAltM: null, maxAltM: null });
    expect(JSON.stringify(useMissionStore.getState().past[0])).toBe(snapshot);
    for (let i = 0; i < 4; i++) s.undo();
    expect(JSON.stringify(useMissionStore.getState().mission)).toBe(snapshot);
    s.redo();
    expect(useMissionStore.getState().mission!.items[3].altitude).toBe(99);
  });

  it('resequenceStable matches resequenceMissionItems by value', () => {
    const m = load(30);
    const shuffled = [...m.items].reverse().map((it, i) => (i % 3 === 0 ? { ...it, latitude: (it.latitude ?? 0) + 0.00000001234 } : it));
    expect(resequenceStable(shuffled, SETTINGS)).toEqual(resequenceMissionItems(shuffled, SETTINGS));
  });
});
