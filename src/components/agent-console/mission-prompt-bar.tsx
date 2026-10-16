'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/base/buttons/button';
import { INK_BUTTON } from '@/components/editor/editor-styles';
import { Textarea } from '@/components/base/textarea/textarea';
import { useMissionStore } from '@/lib/store/mission-store';
import { missionToConfig, zonesToNfzs } from '@/lib/store/constraints-store';
import { zonesToGeofences } from '@/lib/store/geofence-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { runFlightDeck } from '@/lib/agents/client';
import type { FlightDeckRequest } from '@/lib/agents/schemas';

/** Prompt form inside the assistant drawer. Sends the mission's zones and rated
 * endurance so the pre-flight audit runs against the same rules as the Checks tab. */
export function MissionPromptBar() {
  const [value, setValue] = useState('');
  const mission = useMissionStore((s) => s.mission);
  const { status, startRun, addEvent, finishRun, fail } = useAgentStore();
  const running = status === 'running';

  const submit = useCallback(async () => {
    if (!mission || !value.trim() || running) return;
    const enabledZones = mission.zones.filter((z) => z.enabled);
    const s = mission.settings;
    const request: FlightDeckRequest = {
      prompt: value.trim(),
      settings: {
        defaultAltitude: s.defaultAltitude,
        defaultSpeed: s.defaultSpeed,
        defaultLoiterTime: s.defaultLoiterTime,
        defaultWaitTime: s.defaultWaitTime,
        altitudeReference: 'relative',
      },
      constraints: missionToConfig(mission),
      nfzs: zonesToNfzs(enabledZones),
      geofences: zonesToGeofences(enabledZones),
      homePosition: mission.homePosition ?? null,
      // Unified zones replace nfzs/geofences in the audit when present.
      zones: enabledZones,
      ...(s.ratedEnduranceS ? { ratedEnduranceS: s.ratedEnduranceS } : {}),
    };

    startRun(request.prompt);
    setValue('');
    await runFlightDeck(request, {
      onEvent: (event) => {
        addEvent(event);
        if (event.type === 'done') finishRun(event.payload);
      },
      onDone: () => {},
      onError: (message) => fail(message),
    });
  }, [mission, value, running, startRun, addEvent, finishRun, fail]);

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Textarea
        aria-label="Describe the mission"
        placeholder="e.g. Survey the field north of home at 60 m, then return"
        rows={2}
        autoResize
        maxRows={6}
        value={value}
        onChange={setValue}
        isDisabled={!mission || running}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
        }}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-text-tertiary">Nothing changes until you load the draft.</span>
        <Button type="submit" size="small" variant="secondary" disabled={!mission || running || !value.trim()} className={INK_BUTTON}>
          {running ? 'Drafting…' : 'Draft'}
        </Button>
      </div>
    </form>
  );
}
