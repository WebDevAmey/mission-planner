'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, CloudOff, Loader2 } from 'lucide-react';
import { ArduPilotLayout } from '@/components/layout/ardupilot-layout';
import { useMissionStore } from '@/lib/store/mission-store';
import { useAutosaveMission } from '@/hooks/useAutosaveMission';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';

function SaveStatusIndicator({ status }: { status: ReturnType<typeof useAutosaveMission> }) {
  if (status === 'idle') return null;

  return (
    <div
      className={cn(
        'pointer-events-none fixed bottom-2 left-1/2 z-[2000] flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] shadow-lg',
        status === 'saving' && 'border-border-mid bg-bg-raised text-text-dim',
        status === 'saved' && 'border-green/40 bg-green-bg text-green',
        status === 'error' && 'border-red/40 bg-red-bg text-red'
      )}
    >
      {status === 'saving' && <Loader2 size={11} className="animate-spin" />}
      {status === 'saved' && <Check size={11} />}
      {status === 'error' && <CloudOff size={11} />}
      {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Could not save'}
    </div>
  );
}

function MissionPlannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const missionId = searchParams.get('mission');
  const { mission, loadMission } = useMissionStore();
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!missionId) {
      router.replace('/dashboard');
      return;
    }

    let cancelled = false;
    setLoadState('loading');

    (async () => {
      try {
        const res = await fetch(`/api/missions/${missionId}`);
        if (cancelled) return;
        if (!res.ok) {
          setLoadState('error');
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        loadMission(data.mission);
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  const saveStatus = useAutosaveMission(mission, missionId);

  if (loadState === 'loading') {
    return (
      <div className="flex h-dvh items-center justify-center bg-bg-base">
        <Spinner size={22} />
      </div>
    );
  }

  if (loadState === 'error') {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg-base px-6 text-center">
        <p className="font-mono text-[13px] text-text-dim">
          This mission could not be found, or you don&apos;t have access to it.
        </p>
        <ButtonLink href="/dashboard" variant="primary" className="font-sans">
          Back to dashboard
        </ButtonLink>
      </div>
    );
  }

  if (!mission || mission.id !== missionId) return null;

  return (
    <>
      <ArduPilotLayout />
      <SaveStatusIndicator status={saveStatus} />
    </>
  );
}

export default function MissionPlannerPage() {
  return (
    <Suspense fallback={null}>
      <MissionPlannerContent />
    </Suspense>
  );
}
