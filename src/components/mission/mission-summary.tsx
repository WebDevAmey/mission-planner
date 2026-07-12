'use client';

import React from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { totalMissionDistance, estimatedFlightTime } from '@/lib/services/mission-builder';
import { computeRiskScore } from '@/lib/services/risk-scorer';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import { formatDuration } from '@/lib/utils';

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

  const riskColor =
    risk.level === 'LOW'
      ? 'var(--color-green)'
      : risk.level === 'MEDIUM'
      ? 'var(--color-amber)'
      : 'var(--color-red)';

  const statStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1px',
    padding: '0 12px',
    borderRight: '1px solid var(--color-border)',
  };

  const labelS: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
  };

  const valueS: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--color-text)',
  };

  return (
    <div style={{
      height: '36px',
      backgroundColor: '#0d0d0d',
      borderTop: '1px solid var(--color-border-mid)',
      borderBottom: '1px solid var(--color-border-mid)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 8px',
      flexShrink: 0,
      gap: '0',
      overflowX: 'auto',
    }}>
      <div style={statStyle}>
        <span style={labelS}>Waypoints</span>
        <span style={valueS}>{spatialCount}</span>
      </div>
      <div style={statStyle}>
        <span style={labelS}>Distance</span>
        <span style={valueS}>
          {distM >= 1000 ? `${(distM / 1000).toFixed(2)} km` : `${Math.round(distM)} m`}
        </span>
      </div>
      <div style={statStyle}>
        <span style={labelS}>Est. Time</span>
        <span style={valueS}>{formatDuration(Math.round(timeS))}</span>
      </div>
      <div style={statStyle}>
        <span style={labelS}>Max Alt</span>
        <span style={valueS}>{maxAlt.toFixed(1)} m</span>
      </div>
      <div style={{ ...statStyle, borderRight: 'none' }}>
        <span style={labelS}>Risk</span>
        <span style={{ ...valueS, color: riskColor }}>
          {risk.total.toFixed(0)} <span style={{ fontSize: '9px' }}>{risk.level}</span>
        </span>
      </div>
    </div>
  );
}
