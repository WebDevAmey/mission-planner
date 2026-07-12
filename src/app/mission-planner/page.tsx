'use client';

import { useEffect } from 'react';
import { ArduPilotLayout } from '@/components/layout/ardupilot-layout';
import { useMissionStore } from '@/lib/store/mission-store';

export default function MissionPlannerPage() {
  const { mission, createMission } = useMissionStore();

  useEffect(() => {
    if (!mission) {
      createMission('Mission 001');
    }
  }, [mission, createMission]);

  if (!mission) {
    return null;
  }

  return <ArduPilotLayout />;
}
