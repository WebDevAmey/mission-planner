'use client';

import React from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { computeViolationCount, computeRiskScore } from '@/lib/services/risk-scorer';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import { haversineDistance } from '@/lib/utils';
import type { MissionPlan } from '@/types/mission';

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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '2px 5px',
    backgroundColor: 'var(--color-bg-raised)',
    border: '1px solid var(--color-border-mid)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '9px',
    color: 'var(--color-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.4px',
    display: 'block',
    marginBottom: '2px',
  };

  if (!constraintsPanelOpen) return null;

  return (
    <div style={{
      width: '220px',
      backgroundColor: 'var(--color-bg-panel)',
      borderLeft: '1px solid var(--color-border)',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflowY: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '5px 8px', backgroundColor: '#0d0d0d',
        borderBottom: '1px solid var(--color-border-mid)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldAlert size={13} color={violationCount > 0 ? 'var(--color-red)' : 'var(--color-green)'} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
            color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px',
          }}>
            Constraints
          </span>
          {violationCount > 0 && (
            <span className="badge badge-red">{violationCount}</span>
          )}
        </div>
        <button onClick={toggleConstraintsPanel} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--color-text-muted)', display: 'flex', padding: '2px',
        }}>
          <X size={12} />
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* Config inputs */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '6px', fontWeight: 600 }}>
            Limits
          </div>
          <div style={{ display: 'grid', gap: '6px' }}>
            <div>
              <label style={labelStyle}>Max Distance (m)</label>
              <input type="number" style={inputStyle} value={config.maxDistanceM}
                onChange={(e) => updateConfig({ maxDistanceM: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={labelStyle}>Max Altitude AGL (m)</label>
              <input type="number" style={inputStyle} value={config.maxAltM}
                onChange={(e) => updateConfig({ maxAltM: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={labelStyle}>Min Altitude AGL (m)</label>
              <input type="number" style={inputStyle} value={config.minAltM}
                onChange={(e) => updateConfig({ minAltM: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={labelStyle}>Max Speed (m/s)</label>
              <input type="number" style={inputStyle} value={config.maxSpeedMs}
                onChange={(e) => updateConfig({ maxSpeedMs: parseFloat(e.target.value) || 0 })} />
            </div>
            <div>
              <label style={labelStyle}>Default Speed (m/s)</label>
              <input type="number" style={inputStyle} value={config.defaultSpeedMs}
                onChange={(e) => updateConfig({ defaultSpeedMs: parseFloat(e.target.value) || 10 })} />
            </div>
            <div>
              <label style={labelStyle}>Min AGL Clearance (m)</label>
              <input type="number" style={inputStyle} value={config.minAGLClearance}
                onChange={(e) => updateConfig({ minAGLClearance: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
        </div>

        {/* Risk score */}
        {riskBreakdown && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '4px', fontWeight: 600 }}>
              Risk Score
            </div>
            <div style={{
              padding: '6px 8px', backgroundColor: 'var(--color-bg-raised)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${riskBreakdown.level === 'LOW' ? 'var(--color-green)' : riskBreakdown.level === 'MEDIUM' ? 'var(--color-amber)' : 'var(--color-red)'}`,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '18px', fontWeight: 700,
                  color: riskBreakdown.level === 'LOW' ? 'var(--color-green)' : riskBreakdown.level === 'MEDIUM' ? 'var(--color-amber)' : 'var(--color-red)' }}>
                  {riskBreakdown.total.toFixed(0)}
                </span>
                <span className={`badge ${riskBreakdown.level === 'LOW' ? 'badge-green' : riskBreakdown.level === 'MEDIUM' ? 'badge-amber' : 'badge-red'}`}>
                  {riskBreakdown.level}
                </span>
              </div>
              {[
                ['Distance', riskBreakdown.distanceScore, 40],
                ['NFZ', riskBreakdown.nfzScore, 30],
                ['Altitude', riskBreakdown.altScore, 20],
                ['Violations', riskBreakdown.violationScore, 10],
              ].map(([label, score, max]) => (
                <div key={String(label)} style={{ marginBottom: '3px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', marginBottom: '1px' }}>
                    <span>{label}</span><span>{Number(score).toFixed(1)}/{max}</span>
                  </div>
                  <div style={{ height: '3px', backgroundColor: 'var(--color-bg-hover)', borderRadius: '2px' }}>
                    <div style={{ height: '3px', borderRadius: '2px', width: `${Math.min(100, (Number(score) / Number(max)) * 100)}%`, backgroundColor: 'var(--color-amber)' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Violations */}
        {violations.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-red)', marginBottom: '4px', fontWeight: 600 }}>
              Violations ({violations.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {violations.map((v, i) => (
                <div key={i} style={{
                  padding: '4px 6px', backgroundColor: 'var(--color-red-bg)',
                  border: '1px solid var(--color-red)', borderRadius: 'var(--radius-sm)',
                  fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-red)',
                }}>
                  {v}
                </div>
              ))}
            </div>
          </div>
        )}

        {violations.length === 0 && items.length > 0 && (
          <div style={{ padding: '6px 8px', backgroundColor: 'var(--color-green-bg)', border: '1px solid var(--color-green)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-green)' }}>
            ✓ No violations
          </div>
        )}

        {/* NFZ list */}
        {nfzs.length > 0 && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-dim)', marginBottom: '4px', fontWeight: 600 }}>
              No-Fly Zones ({nfzs.length})
            </div>
            {nfzs.map((nfz) => (
              <div key={nfz.id}
                onClick={() => selectNfz(nfz.id === selectedNfzId ? null : nfz.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '3px 6px', marginBottom: '2px', cursor: 'pointer',
                  backgroundColor: nfz.id === selectedNfzId ? 'var(--color-red-bg)' : 'var(--color-bg-raised)',
                  border: `1px solid ${nfz.id === selectedNfzId ? 'var(--color-red)' : 'var(--color-border-mid)'}`,
                  borderRadius: 'var(--radius-sm)',
                }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text)' }}>
                  {nfz.label} ({nfz.radiusM}m)
                </span>
                <button onClick={(e) => { e.stopPropagation(); deleteNfz(nfz.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', padding: '1px' }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
