'use client';

import React, { useRef, useEffect } from 'react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { useUIStore } from '@/lib/store/ui-store';
import { COMMAND_ICONS, getMissionCommandDefinition } from '@/lib/mavlink/commands';
import { computeMissionMetrics } from '@/lib/services/metrics-service';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { Clock } from 'lucide-react';

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
      <div className="h-[72px] shrink-0 border-b border-border-mid bg-[#080808]">
        <EmptyState icon={Clock} title="No mission items" description="Add waypoints to see the timeline" className="h-full justify-center py-0" />
      </div>
    );
  }

  let spatialSeq = -1;
  let segIdx = 0;

  return (
    <div
      className="h-[88px] shrink-0 overflow-x-auto overflow-y-hidden border-b border-border-mid bg-[#080808]"
      ref={scrollRef}
    >
      <div className="flex h-full min-w-max items-center gap-0 px-4">
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
              className={cn(
                'flex shrink-0 flex-col items-center justify-center rounded-md border transition-all duration-150 cursor-pointer',
                isNonSpatial ? 'h-12 min-w-[60px] px-2 py-1' : 'h-16 min-w-[80px] px-3 py-1.5',
                isSelected
                  ? 'border-green bg-green-bg shadow-[0_0_8px_rgba(0,255,65,0.3)]'
                  : 'border-border-mid bg-bg-raised'
              )}
            >
              <div className={isNonSpatial ? 'text-sm leading-none' : 'text-lg leading-none'}>{icon}</div>
              <div
                className={cn(
                  'mt-0.5 whitespace-nowrap font-mono',
                  isNonSpatial ? 'text-[8px]' : 'text-[9px]',
                  isSelected ? 'font-bold text-green' : 'font-medium text-text'
                )}
              >
                {stepLabel(item.name, spatialSeq)}
              </div>
              {!isNonSpatial && (
                <div className="mt-px font-mono text-[8px] text-text-muted">
                  {item.altitude !== null ? `${item.altitude}m` : '—'}
                  {item.speed ? ` · ${item.speed}m/s` : ''}
                </div>
              )}
              <div className="mt-px font-mono text-[7px] text-text-muted">
                #{idx + 1}
              </div>
            </div>
          );

          const arrow = idx < items.length - 1 ? (
            <div key={`arrow-${idx}`} className="flex shrink-0 flex-col items-center justify-center px-1">
              <div className="h-px w-5 bg-border-mid" />
              {segDist !== null && segDist !== undefined && (
                <div className="mt-0.5 whitespace-nowrap font-mono text-[7px] text-text-muted">
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
