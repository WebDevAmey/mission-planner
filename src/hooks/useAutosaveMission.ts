import { useEffect, useRef, useState } from 'react';
import type { MissionPlan } from '@/types/mission';

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error';

const DEBOUNCE_MS = 900;

/** Debounced autosave for the mission currently open in the editor. Skips the
 * save that would otherwise fire immediately after a fresh load (the mission
 * object just came from the server, so there's nothing new to persist). */
export function useAutosaveMission(mission: MissionPlan | null, missionId: string | null): AutosaveStatus {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedMissionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mission || !missionId || mission.id !== missionId) return;

    if (loadedMissionIdRef.current !== missionId) {
      loadedMissionIdRef.current = missionId;
      return;
    }

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(async () => {
      setStatus('saving');
      try {
        const res = await fetch(`/api/missions/${missionId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: mission.name,
            description: mission.description ?? null,
            homePosition: mission.homePosition ?? null,
            settings: mission.settings,
            items: mission.items,
          }),
        });
        setStatus(res.ok ? 'saved' : 'error');
      } catch {
        setStatus('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [mission, missionId]);

  return status;
}
