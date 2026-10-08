'use client';

import React, { useState, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { runFlightDeck } from '@/lib/agents/client';
import type { FlightDeckRequest } from '@/lib/agents/schemas';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';

export function MissionPromptBar() {
  const [value, setValue] = useState('');
  const { mission } = useMissionStore();
  const { config, nfzs } = useConstraintsStore();
  const { geofences } = useGeofenceStore();
  const { status, startRun, addEvent, finishRun, fail, setConsoleOpen } = useAgentStore();

  const running = status === 'running';

  const submit = useCallback(async () => {
    if (!mission || !value.trim() || running) return;

    const request: FlightDeckRequest = {
      prompt: value.trim(),
      settings: mission.settings,
      constraints: config,
      nfzs,
      geofences,
      homePosition: mission.homePosition ?? null,
    };

    startRun(request.prompt);
    setConsoleOpen(true);
    setValue('');

    await runFlightDeck(request, {
      onEvent: (event) => {
        addEvent(event);
        if (event.type === 'done') {
          finishRun(event.payload);
        }
      },
      onDone: () => {},
      onError: (message) => fail(message),
    });
  }, [mission, value, running, config, nfzs, geofences, startRun, setConsoleOpen, addEvent, finishRun, fail]);

  return (
    <div className="flex h-7 min-w-[160px] max-w-[420px] flex-1 items-center gap-1.5 px-2">
      <Sparkles size={12} className="shrink-0 text-cyan" />
      <Input
        type="text"
        value={value}
        disabled={!mission || running}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Ask Flight Deck to plan a mission…"
        className="h-6 min-w-0 flex-1 px-2"
      />
      <button
        onClick={submit}
        disabled={!mission || running || !value.trim()}
        title="Plan with Flight Deck"
        className="flex h-6 shrink-0 items-center gap-1 rounded-sm border border-blue bg-blue-bg px-2 font-mono text-[10px] font-bold text-blue transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {running ? <Spinner size={11} className="text-blue" /> : <Sparkles size={11} />}
        {running ? 'Planning…' : 'Plan'}
      </button>
    </div>
  );
}
