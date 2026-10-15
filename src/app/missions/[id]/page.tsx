'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EditorShell } from '@/components/editor/editor-shell';
import { useMissionStore } from '@/lib/store/mission-store';
import { useAutosaveMission } from '@/hooks/useAutosaveMission';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type LoadState = { kind: 'loading' } | { kind: 'ready'; version: number | null } | { kind: 'error'; message: string };

export default function MissionEditorPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const missionId = params?.id ?? null;
  const mission = useMissionStore((s) => s.mission);
  const loadMission = useMissionStore((s) => s.loadMission);
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!missionId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/missions/${missionId}`);
        if (cancelled) return;
        if (res.status === 401) {
          router.replace(`/login?next=${encodeURIComponent(`/missions/${missionId}`)}`);
          return;
        }
        if (!res.ok) {
          setLoad({ kind: 'error', message: "This mission could not be found, or you don't have access to it." });
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        loadMission(data.mission);
        setLoad({ kind: 'ready', version: typeof data.mission?.version === 'number' ? data.mission.version : null });
      } catch {
        if (!cancelled) setLoad({ kind: 'error', message: 'Could not reach the server. Check your connection and try again.' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [missionId, loadMission, router]);

  useAutosaveMission(missionId, load.kind === 'ready' ? load.version : null);

  if (load.kind === 'loading' || (load.kind === 'ready' && (!mission || mission.id !== missionId))) {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg-base" role="status" aria-label="Loading mission">
        <Spinner size={22} />
      </div>
    );
  }

  if (load.kind === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-bg-base px-6 text-center">
        <p className="max-w-sm text-sm text-text-dim">{load.message}</p>
        <ButtonLink href="/dashboard" variant="primary">
          Back to missions
        </ButtonLink>
      </div>
    );
  }

  return <EditorShell />;
}
