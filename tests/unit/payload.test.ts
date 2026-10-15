import { describe, expect, it } from 'vitest';
import { updateMissionSchema } from '@/lib/validation/mission';
import { fromWaypointInput, toMissionPatchBody, toWaypointInput } from '@/lib/missions/payload';
import { sampleMission } from './fixtures';

describe('mission payload mapping', () => {
  it('produces a body accepted by updateMissionSchema', () => {
    const mission = sampleMission();
    const body = toMissionPatchBody(mission);
    const parsed = updateMissionSchema.safeParse(body);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    expect(body.items).toHaveLength(mission.items.length);
    expect(body.items?.[1].param1).toBe(mission.items[1].parameters.param1);
  });

  it('the raw editor shape is rejected (regression for the save bug)', () => {
    const mission = sampleMission();
    expect(updateMissionSchema.safeParse({ items: mission.items }).success).toBe(false);
  });

  it('round-trips through fromWaypointInput', () => {
    const it0 = sampleMission().items[1];
    const back = fromWaypointInput(toWaypointInput(it0, 1));
    expect(back.parameters).toEqual(it0.parameters);
    expect(back.latitude).toBe(it0.latitude);
  });
});
