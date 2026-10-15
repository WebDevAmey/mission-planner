import { describe, expect, it } from 'vitest';
import { updateMissionSchema } from '@/lib/validation/mission';
import { createMissionItem } from '@/lib/services/mission-builder';
import { PlannerAction } from '@/lib/mavlink/commands';
import { toEditorMission } from '@/lib/store/editor-types';
import { buildMissionPatch } from '@/hooks/mission-payload';

const settings = { defaultAltitude: 80, defaultSpeed: 12, defaultLoiterTime: 30, defaultWaitTime: 10, altitudeReference: 'relative' as const };

describe('autosave payload', () => {
  it('passes updateMissionSchema with several waypoints (regression: nested parameters)', () => {
    const items = [
      createMissionItem(PlannerAction.TAKEOFF, 0, settings, { latitude: 47.1, longitude: 8.1, altitude: 30 }),
      createMissionItem(PlannerAction.WAYPOINT, 1, settings, { latitude: 47.2, longitude: 8.2, altitude: 60 }),
      createMissionItem(PlannerAction.RTL, 2, settings),
    ];
    const mission = toEditorMission({
      id: 'm1', name: 'Test', createdAt: '', updatedAt: '', items, settings, homePosition: null,
    });
    const body = buildMissionPatch(mission, 3);
    const parsed = updateMissionSchema.safeParse(body);
    expect(parsed.success).toBe(true);
    expect(body.items!).toHaveLength(3);
    expect(body.items![1]).toMatchObject({ sequence: 1, latitude: 47.2, param1: expect.any(Number) });
    expect(body.baseVersion).toBe(3);
  });
});
