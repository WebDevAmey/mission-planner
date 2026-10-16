'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EditorShell, loadMissionMap } from '@/components/editor/editor-shell';
import { useMissionStore } from '@/lib/store/mission-store';
import { useAutosaveMission } from '@/hooks/useAutosaveMission';
import { ButtonLink } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

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
    // Fetch the map chunk while the mission loads, so it is ready when the skeleton goes.
    void loadMissionMap().catch(() => {});
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
      <div className="flex h-dvh flex-col bg-background-primary-default" role="status" aria-label="Loading mission">
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-separator-border px-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-40" />
          <div className="flex-1" />
          <Skeleton className="h-8 w-24 rounded-fd-control" />
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-12 shrink-0 border-r border-separator-border md:block" />
          <div className="min-w-0 flex-1 bg-background-secondary-default" />
          <div className="hidden w-[360px] shrink-0 flex-col gap-3 border-l border-separator-border p-3 lg:flex">
            <Skeleton className="h-8 w-full rounded-fd-control" />
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        </div>
        <div className="h-8 shrink-0 border-t border-separator-border" />
      </div>
    );
  }

  if (load.kind === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background-full px-6 text-center">
        <p className="max-w-sm text-[14px] text-text-secondary">{load.message}</p>
        <ButtonLink href="/dashboard" variant="primary">
          Back to missions
        </ButtonLink>
      </div>
    );
  }

  return <EditorShell />;
}
