'use client';

import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { computeViolationCount, computeRiskScore } from '@/lib/services/risk-scorer';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import { haversineDistance, cn } from '@/lib/utils';
import type { MissionPlan } from '@/types/mission';
import { Input, Label } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { IconButton } from '@/components/ui/button';

function totalMissionDist(mission: MissionPlan | null): number {
  if (!mission) return 0;
  const spatial = mission.items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  );
  let d = 0;
  for (let i = 1; i < spatial.length; i++) {
    d += haversineDistance(
      spatial[i - 1].latitude!, spatial[i - 1].longitude!,
      spatial[i].latitude!, spatial[i].longitude!
    );
  }
  return d;
}

const RISK_VARIANT: Record<'LOW' | 'MEDIUM' | 'HIGH', 'green' | 'amber' | 'red'> = {
  LOW: 'green',
  MEDIUM: 'amber',
  HIGH: 'red',
};
const RISK_TEXT_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'text-green',
  MEDIUM: 'text-amber',
  HIGH: 'text-red',
};
const RISK_BORDER_CLASS: Record<'LOW' | 'MEDIUM' | 'HIGH', string> = {
  LOW: 'border-green',
  MEDIUM: 'border-amber',
  HIGH: 'border-red',
};

export function ConstraintsPanel() {
  const { config, updateConfig, nfzs, deleteNfz, selectNfz, selectedNfzId } =
    useConstraintsStore();
  const { constraintsPanelOpen, toggleConstraintsPanel } = useUIStore();
  const { mission } = useMissionStore();

  const items = mission?.items ?? [];
  const totalDist = totalMissionDist(mission);
  const violationCount = computeViolationCount(items, config, nfzs, totalDist);
  const riskBreakdown = mission
    ? computeRiskScore(items, config, nfzs)
    : null;

  const violations: string[] = [];
  if (totalDist > config.maxDistanceM)
    violations.push(`Total distance ${Math.round(totalDist)}m exceeds limit ${config.maxDistanceM}m`);

  const maxAlt = items.reduce(
    (max, i) => (i.altitude !== null && i.altitude > max ? i.altitude : max),
    0
  );
  if (maxAlt > config.maxAltM)
    violations.push(`Max altitude ${maxAlt.toFixed(1)}m exceeds limit ${config.maxAltM}m`);

  for (const item of items) {
    if (
      supportsCoordinates(item.action) &&
      item.altitude !== null &&
      item.altitude < config.minAltM
    ) {
      violations.push(
        `Item ${item.sequence + 1} (${item.name}) altitude ${item.altitude.toFixed(1)}m below minimum ${config.minAltM}m`
      );
    }
  }

  for (const item of items) {
    if (!supportsCoordinates(item.action) || item.latitude === null || item.longitude === null) continue;
    for (const nfz of nfzs) {
      const d = haversineDistance(item.latitude!, item.longitude!, nfz.latitude, nfz.longitude);
      if (d < nfz.radiusM) {
        violations.push(`Item ${item.sequence + 1} (${item.name}) is inside NFZ "${nfz.label}"`);
        break;
      }
    }
  }

  if (!constraintsPanelOpen) return null;

  return (
    <div className="flex w-[220px] shrink-0 flex-col overflow-y-auto border-l border-border bg-bg-panel">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-border-mid bg-[#0d0d0d] px-2 py-1">
        <div className="flex items-center gap-1.5">
          <ShieldAlert size={13} className={violationCount > 0 ? 'text-red' : 'text-green'} />
          <span className="font-mono text-[10px] font-bold uppercase tracking-wide text-text">
            Constraints
          </span>
          {violationCount > 0 && <Badge variant="red">{violationCount}</Badge>}
        </div>
        <IconButton
          icon={<X size={12} />}
          aria-label="Close constraints panel"
          size="xs"
          onClick={toggleConstraintsPanel}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Config inputs */}
        <div className="mb-2.5">
          <div className="mb-1.5 font-mono text-[10px] font-semibold text-text-dim">
            Limits
          </div>
          <div className="grid gap-1.5">
            <div>
              <Label>Max Distance (m)</Label>
              <Input type="number" value={config.maxDistanceM}
                onChange={(e) => updateConfig({ maxDistanceM: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Max Altitude AGL (m)</Label>
              <Input type="number" value={config.maxAltM}
                onChange={(e) => updateConfig({ maxAltM: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Min Altitude AGL (m)</Label>
              <Input type="number" value={config.minAltM}
                onChange={(e) => updateConfig({ minAltM: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Max Speed (m/s)</Label>
              <Input type="number" value={config.maxSpeedMs}
                onChange={(e) => updateConfig({ maxSpeedMs: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <Label>Default Speed (m/s)</Label>
              <Input type="number" value={config.defaultSpeedMs}
                onChange={(e) => updateConfig({ defaultSpeedMs: parseFloat(e.target.value) || 10 })} />
            </div>
            <div>
              <Label>Min AGL Clearance (m)</Label>
              <Input type="number" value={config.minAGLClearance}
                onChange={(e) => updateConfig({ minAGLClearance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        {/* Risk score */}
        {riskBreakdown && (
          <div className="mb-2.5">
            <div className="mb-1 font-mono text-[10px] font-semibold text-text-dim">
              Risk Score
            </div>
            <div className={cn('rounded-sm border bg-bg-raised px-2 py-1.5', RISK_BORDER_CLASS[riskBreakdown.level])}>
              <div className="mb-1 flex items-center justify-between">
                <span className={cn('font-mono text-lg font-bold', RISK_TEXT_CLASS[riskBreakdown.level])}>
                  {riskBreakdown.total.toFixed(0)}
                </span>
                <Badge variant={RISK_VARIANT[riskBreakdown.level]}>{riskBreakdown.level}</Badge>
              </div>
              {[
                ['Distance', riskBreakdown.distanceScore, 40],
                ['NFZ', riskBreakdown.nfzScore, 30],
                ['Altitude', riskBreakdown.altScore, 20],
                ['Violations', riskBreakdown.violationScore, 10],
              ].map(([label, score, max]) => (
                <div key={String(label)} className="mb-0.5">
                  <div className="mb-0.5 flex justify-between font-mono text-[9px] text-text-muted">
                    <span>{label}</span><span>{Number(score).toFixed(1)}/{max}</span>
                  </div>
                  <div className="h-[3px] rounded-[2px] bg-bg-hover">
                    <div
                      className="h-[3px] rounded-[2px] bg-amber"
                      style={{ width: `${Math.min(100, (Number(score) / Number(max)) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Violations */}
        {violations.length > 0 && (
          <div className="mb-2.5">
            <div className="mb-1 font-mono text-[10px] font-semibold text-red">
              Violations ({violations.length})
            </div>
            <div className="flex flex-col gap-1">
              {violations.map((v, i) => (
                <div key={i} className="rounded-sm border border-red bg-red-bg px-1.5 py-1 font-mono text-[10px] text-red">
                  {v}
                </div>
              ))}
            </div>
          </div>
        )}

        {violations.length === 0 && items.length > 0 && (
          <div className="rounded-sm border border-green bg-green-bg px-2 py-1.5 font-mono text-[10px] text-green">
            ✓ No violations
          </div>
        )}

        {/* NFZ list */}
        {nfzs.length > 0 && (
          <div className="mt-2.5">
            <div className="mb-1 font-mono text-[10px] font-semibold text-text-dim">
              No-Fly Zones ({nfzs.length})
            </div>
            {nfzs.map((nfz) => (
              <div key={nfz.id}
                onClick={() => selectNfz(nfz.id === selectedNfzId ? null : nfz.id)}
                className={cn(
                  'mb-0.5 flex cursor-pointer items-center justify-between rounded-sm border px-1.5 py-0.5',
                  nfz.id === selectedNfzId
                    ? 'border-red bg-red-bg'
                    : 'border-border-mid bg-bg-raised'
                )}
              >
                <span className="font-mono text-[10px] text-text">
                  {nfz.label} ({nfz.radiusM}m)
                </span>
                <IconButton
                  icon={<X size={11} />}
                  aria-label={`Delete NFZ ${nfz.label}`}
                  size="xs"
                  onClick={(e) => { e.stopPropagation(); deleteNfz(nfz.id); }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
