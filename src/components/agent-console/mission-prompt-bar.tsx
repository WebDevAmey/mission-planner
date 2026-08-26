'use client';

import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { runFlightDeck } from '@/lib/agents/client';
import type { FlightDeckRequest } from '@/lib/agents/schemas';

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
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px', height: '28px',
      padding: '0 8px', flex: '1 1 auto', minWidth: '160px', maxWidth: '420px',
    }}>
      <Sparkles size={12} color="var(--color-cyan)" style={{ flexShrink: 0 }} />
      <input
        type="text"
        value={value}
        disabled={!mission || running}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder="Ask Flight Deck to plan a mission…"
        style={{
          flex: 1, background: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
          borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', fontFamily: 'var(--font-mono)',
          fontSize: '11px', padding: '4px 8px', outline: 'none', minWidth: 0,
        }}
      />
      <button
        onClick={submit}
        disabled={!mission || running || !value.trim()}
        title="Plan with Flight Deck"
        style={{
          display: 'flex', alignItems: 'center', gap: '4px', height: '24px', padding: '0 8px',
          background: 'var(--color-blue-bg)', border: '1px solid var(--color-blue)',
          borderRadius: 'var(--radius-sm)', color: 'var(--color-blue)',
          fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          cursor: running || !value.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
          opacity: running || !value.trim() ? 0.5 : 1,
        }}
      >
        {running ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        {running ? 'Planning…' : 'Plan'}
      </button>
    </div>
  );
}
