'use client';

import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { totalMissionDistance, estimatedFlightTime } from '@/lib/services/mission-builder';
import { computeRiskScore } from '@/lib/services/risk-scorer';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import { formatDuration, cn } from '@/lib/utils';

const RISK_TEXT_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'text-green',
  MEDIUM: 'text-amber',
  HIGH: 'text-red',
};

function Stat({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center gap-px px-3', !last && 'border-r border-border')}>
      <span className="font-mono text-[9px] uppercase tracking-wide text-text-muted">{label}</span>
      <span className="font-mono text-xs font-bold text-text">{children}</span>
    </div>
  );
}

export function MissionSummary() {
  const { mission } = useMissionStore();
  const { config, nfzs } = useConstraintsStore();

  if (!mission || mission.items.length === 0) return null;

  const spatialCount = mission.items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  ).length;

  const distM = totalMissionDistance(mission);
  const timeS = estimatedFlightTime(mission, mission.settings.defaultSpeed);
  const maxAlt = mission.items.reduce(
    (m, i) => (i.altitude !== null && i.altitude > m ? i.altitude : m),
    0
  );
  const risk = computeRiskScore(mission.items, config, nfzs);

  return (
    <div className="flex h-9 shrink-0 items-center overflow-x-auto border-y border-border-mid bg-[#0d0d0d] px-2">
      <Stat label="Waypoints">{spatialCount}</Stat>
      <Stat label="Distance">
        {distM >= 1000 ? `${(distM / 1000).toFixed(2)} km` : `${Math.round(distM)} m`}
      </Stat>
      <Stat label="Est. Time">{formatDuration(Math.round(timeS))}</Stat>
      <Stat label="Max Alt">{maxAlt.toFixed(1)} m</Stat>
      <Stat label="Risk" last>
        <span className={RISK_TEXT_CLASS[risk.level]}>
          {risk.total.toFixed(0)} <span className="text-[9px]">{risk.level}</span>
        </span>
      </Stat>
    </div>
  );
}
