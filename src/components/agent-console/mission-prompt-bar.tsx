'use client';

import { useCallback, useState } from 'react';
import { RiSparklingLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Textarea } from '@/components/base/textarea/textarea';
import { useMissionStore } from '@/lib/store/mission-store';
import { missionToConfig, zonesToNfzs } from '@/lib/store/constraints-store';
import { zonesToGeofences } from '@/lib/store/geofence-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { runFlightDeck } from '@/lib/agents/client';
import type { FlightDeckRequest } from '@/lib/agents/schemas';

/** Prompt form inside the Flight Deck drawer. Sends the mission's zones and rated
 * endurance so SENTINEL audits against the same rules as the Checks tab. */
export function MissionPromptBar() {
  const [value, setValue] = useState('');
  const mission = useMissionStore((s) => s.mission);
  const { status, startRun, addEvent, finishRun, fail } = useAgentStore();
  const running = status === 'running';

  const submit = useCallback(async () => {
    if (!mission || !value.trim() || running) return;
    const enabledZones = mission.zones.filter((z) => z.enabled);
    const s = mission.settings;
    const base: FlightDeckRequest = {
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
    };
    // `zones` / `ratedEnduranceS` are optional on the request schema; when present the
    // audit uses the unified zone list instead of the legacy nfzs/geofences.
    const extra = { zones: enabledZones, ...(s.ratedEnduranceS ? { ratedEnduranceS: s.ratedEnduranceS } : {}) };
    const request = { ...base, ...extra } as FlightDeckRequest;

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
        <span className="text-caption-1-regular text-text-tertiary">Nothing changes until you approve.</span>
        <Button type="submit" size="small" variant="primary" leadingIcon={RiSparklingLine} disabled={!mission || running || !value.trim()}>
          {running ? 'Planning…' : 'Plan'}
        </Button>
      </div>
    </form>
  );
}
