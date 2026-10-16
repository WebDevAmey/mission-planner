'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { hasUnsavedChanges, useSaveStore } from '@/lib/store/save-store';
import { buildAutosaveBody, missionPatchParts, type PatchParts } from '@/hooks/mission-payload';
import type { EditorMission } from '@/lib/store/editor-types';

const DEBOUNCE_MS = 900;
const MAX_BACKOFF_MS = 30_000;

/** Content fingerprint of what the server would store (no version, no timestamps); cached per snapshot. */
const fingerprint = (mission: EditorMission) => missionPatchParts(mission).fingerprint;

/**
 * Debounced whole-document autosave (TECHNICAL_SPEC §5.3):
 * - at most one PATCH in flight; edits made meanwhile trigger one follow-up save;
 * - items and zones are only sent when they changed since the last save (the base
 *   version guarantees the server still holds that save), and the server is asked
 *   for a minimal response, so a name edit on a 2,000-item mission stays small;
 * - network/5xx failures retry with exponential backoff (1 s … 30 s);
 * - 4xx failures stop and show the reason; 409 enters the conflict state;
 * - `beforeunload` warns while anything is unsaved.
 * State is published through `useSaveStore` so the header can render it.
 */
export function useAutosaveMission(missionId: string | null, initialVersion: number | null = null) {
  const mission = useMissionStore((s) => s.mission);
  const setSave = useSaveStore((s) => s.set);

  const savedRef = useRef<string | null>(null);
  /** Per-part JSON of the last document the server confirmed (null = unknown, send everything). */
  const savedPartsRef = useRef<PatchParts['json'] | null>(null);
  const loadedIdRef = useRef<string | null>(null);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const followUpRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptsRef = useRef(0);
  const conflictVersionRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const runSave = useCallback(
    (force = false): Promise<boolean> => {
      if (inFlightRef.current) {
        followUpRef.current = true;
        return inFlightRef.current;
      }
      const current = useMissionStore.getState().mission;
      if (!current || !missionId || current.id !== missionId) return Promise.resolve(true);

      const parts = missionPatchParts(current);
      const json = parts.fingerprint;
      if (!force && json === savedRef.current) {
        setSave({ status: 'saved', error: null });
        return Promise.resolve(true);
      }

      clearTimer();
      setSave({ status: 'saving' });
      // Overwrite after a conflict sends everything: the server holds someone else's version.
      const body = buildAutosaveBody(parts, useSaveStore.getState().serverVersion, force ? null : savedPartsRef.current);

      const scheduleRetry = (message: string) => {
        const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attemptsRef.current);
        attemptsRef.current += 1;
        setSave({ status: 'error', error: `${message} Retrying in ${Math.round(delay / 1000)} s.` });
        timerRef.current = setTimeout(() => void runSave(), delay);
      };

      const p = (async () => {
        try {
          const res = await fetch(`/api/missions/${missionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
            body: JSON.stringify(body),
          });
          const data = (await res.json().catch(() => null)) as {
            error?: string;
            currentVersion?: number;
            version?: number;
            mission?: { version?: number };
          } | null;

          if (res.ok) {
            attemptsRef.current = 0;
            savedRef.current = json;
            savedPartsRef.current = parts.json;
            const version = data?.mission?.version ?? data?.version;
            const latest = useMissionStore.getState().mission;
            setSave({
              status: latest && fingerprint(latest) !== json ? 'pending' : 'saved',
              error: null,
              lastSavedAt: Date.now(),
              ...(typeof version === 'number' && { serverVersion: version }),
            });
            return true;
          }
          if (res.status === 409) {
            setSave({ status: 'conflict', error: 'This mission changed elsewhere.' });
            conflictVersionRef.current = typeof data?.currentVersion === 'number' ? data.currentVersion : null;
            return false;
          }
          if (res.status === 401) {
            setSave({ status: 'error', error: 'You were signed out. Sign in again in another tab, then Retry.' });
            return false;
          }
          if (res.status >= 400 && res.status < 500) {
            setSave({ status: 'error', error: data?.error ?? `The server rejected this save (${res.status}).` });
            return false;
          }
          scheduleRetry('Server error.');
          return false;
        } catch {
          scheduleRetry('Network error.');
          return false;
        } finally {
          inFlightRef.current = null;
          if (followUpRef.current) {
            followUpRef.current = false;
            const s = useSaveStore.getState().status;
            if (s !== 'conflict') {
              clearTimer();
              timerRef.current = setTimeout(() => void runSave(), 0);
            }
          }
        }
      })();
      inFlightRef.current = p;
      return p;
    },
    [missionId, setSave]
  );

  // Publish imperative actions for the header (Retry / Overwrite / flush on navigation).
  useEffect(() => {
    setSave({
      flush: () => {
        attemptsRef.current = 0;
        return runSave();
      },
      overwrite: () => {
        if (conflictVersionRef.current !== null) setSave({ serverVersion: conflictVersionRef.current });
        conflictVersionRef.current = null;
        return runSave(true);
      },
    });
  }, [runSave, setSave]);

  // Reset when a different mission is opened.
  useEffect(() => {
    setSave({ status: 'idle', error: null, serverVersion: initialVersion, lastSavedAt: null });
    return () => clearTimer();
  }, [missionId, initialVersion, setSave]);

  // Debounce saves on every document change.
  useEffect(() => {
    if (!mission || !missionId || mission.id !== missionId) return;

    if (loadedIdRef.current !== missionId) {
      loadedIdRef.current = missionId;
      savedRef.current = fingerprint(mission);
      savedPartsRef.current = missionPatchParts(mission).json;
      return;
    }
    if (fingerprint(mission) === savedRef.current) return;

    const status = useSaveStore.getState().status;
    if (status === 'conflict') return; // wait for the user's decision
    if (status !== 'error' && status !== 'saving') setSave({ status: 'pending' });

    clearTimer();
    timerRef.current = setTimeout(() => void runSave(), DEBOUNCE_MS);
  }, [mission, missionId, runSave, setSave]);

  // Warn before closing the tab with unsaved work.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges(useSaveStore.getState().status)) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);
}
