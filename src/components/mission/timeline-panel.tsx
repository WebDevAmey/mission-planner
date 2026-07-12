'use client';

import React, { useRef, useEffect } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { useUIStore } from '@/lib/store/ui-store';
import { COMMAND_ICONS, getMissionCommandDefinition } from '@/lib/mavlink/commands';
import { computeMissionMetrics } from '@/lib/services/metrics-service';

const NON_SPATIAL_ACTIONS = new Set(['wait', 'set_speed', 'condition_distance', 'do_jump', 'cam_trigg_dist', 'set_roi', 'change_altitude']);

function stepLabel(name: string, seq: number): string {
  if (name === 'RETURN_TO_LAUNCH') return 'RTL';
  if (name === 'CONDITION_DELAY') return 'Delay';
  if (name === 'DO_CHANGE_SPEED') return 'Speed';
  if (name === 'DO_SET_ROI') return 'ROI';
  if (name.startsWith('LOITER')) return `Loiter`;
  if (name === 'TAKEOFF') return 'Takeoff';
  if (name === 'LAND') return 'Land';
  if (name === 'WAYPOINT' || name === 'SPLINE_WAYPOINT') return `WP ${seq + 1}`;
  return name.slice(0, 8);
}

export function TimelinePanel() {
  const { mission } = useMissionStore();
  const { config, nfzs } = useConstraintsStore();
  const { geofences } = useGeofenceStore();
  const { selectedMissionItemId, selectMissionItem } = useUIStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  void geofences;

  const items = mission?.items ?? [];
  const metrics = mission
    ? computeMissionMetrics(items, config, nfzs, mission.homePosition)
    : null;

  // Scroll selected item into view
  useEffect(() => {
    if (!selectedMissionItemId || !scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-item-id="${selectedMissionItemId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [selectedMissionItemId]);

  if (items.length === 0) {
    return (
      <div style={{
        height: '72px', backgroundColor: '#080808',
        borderBottom: '1px solid var(--color-border-mid)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-text-muted)',
        flexShrink: 0,
      }}>
        No mission items — add waypoints to see the timeline
      </div>
    );
  }

  let spatialSeq = -1;
  let segIdx = 0;

  return (
    <div style={{
      height: '88px', backgroundColor: '#080808',
      borderBottom: '1px solid var(--color-border-mid)',
      flexShrink: 0, overflowX: 'auto', overflowY: 'hidden',
    }}
      ref={scrollRef}
    >
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '0 16px', height: '100%', gap: '0',
        minWidth: 'max-content',
      }}>
        {items.map((item, idx) => {
          const def = getMissionCommandDefinition(item.action);
          const isSelected = item.id === selectedMissionItemId;
          const isSpatial = def.supportsCoordinates;
          const isNonSpatial = NON_SPATIAL_ACTIONS.has(item.action);
          const icon = COMMAND_ICONS[item.action] ?? '📍';

          if (isSpatial) spatialSeq++;
          const currentSegIdx = isSpatial && spatialSeq > 0 ? segIdx++ : -1;
          const segDist = currentSegIdx >= 0 ? metrics?.segmentDistances[currentSegIdx] : null;
          const segDur = currentSegIdx >= 0 ? metrics?.segmentDurations[currentSegIdx] : null;

          const card = (
            <div
              key={item.id}
              data-item-id={item.id}
              onClick={() => selectMissionItem(item.id)}
              title={`${item.name}\nAlt: ${item.altitude ?? '—'}m\nSpeed: ${item.speed ?? '—'}m/s\nParams: ${item.parameters.param1}, ${item.parameters.param2}, ${item.parameters.param3}, ${item.parameters.param4}`}
              aria-label={`Timeline step: ${item.name}`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isNonSpatial ? '4px 8px' : '6px 12px',
                minWidth: isNonSpatial ? '60px' : '80px',
                height: isNonSpatial ? '48px' : '64px',
                backgroundColor: isSelected
                  ? 'rgba(0,255,65,0.12)'
                  : 'var(--color-bg-raised)',
                border: `1px solid ${isSelected ? 'var(--color-green)' : 'var(--color-border-mid)'}`,
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all 150ms ease',
                boxShadow: isSelected ? '0 0 8px rgba(0,255,65,0.3)' : 'none',
                flexShrink: 0,
              }}
            >
              <div style={{ fontSize: isNonSpatial ? '14px' : '18px', lineHeight: 1 }}>{icon}</div>
              <div style={{
                fontFamily: 'var(--font-mono)', fontSize: isNonSpatial ? '8px' : '9px',
                color: isSelected ? 'var(--color-green)' : 'var(--color-text)',
                fontWeight: isSelected ? 700 : 500, marginTop: '2px', whiteSpace: 'nowrap',
              }}>
                {stepLabel(item.name, spatialSeq)}
              </div>
              {!isNonSpatial && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '8px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                  {item.altitude !== null ? `${item.altitude}m` : '—'}
                  {item.speed ? ` · ${item.speed}m/s` : ''}
                </div>
              )}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--color-text-muted)', marginTop: '1px' }}>
                #{idx + 1}
              </div>
            </div>
          );

          const arrow = idx < items.length - 1 ? (
            <div key={`arrow-${idx}`} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '0 4px', flexShrink: 0,
            }}>
              <div style={{ width: '20px', height: '1px', backgroundColor: 'var(--color-border-mid)' }} />
              {segDist !== null && segDist !== undefined && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '7px', color: 'var(--color-text-muted)', marginTop: '2px', whiteSpace: 'nowrap' }}>
                  {segDist >= 1000 ? `${(segDist / 1000).toFixed(1)}km` : `${Math.round(segDist)}m`}
                  {segDur !== null && segDur !== undefined ? ` · ${Math.round(segDur)}s` : ''}
                </div>
              )}
            </div>
          ) : null;

          return (
            <React.Fragment key={item.id}>
              {card}
              {arrow}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
