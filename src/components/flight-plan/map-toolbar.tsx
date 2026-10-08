'use client';

import {
  MousePointer2,
  MapPin,
  Trash2,
  Home,
  Pentagon,
  Circle,
  Ruler,
  ShieldAlert,
  Mountain,
  Shield,
} from 'lucide-react';
import { useUIStore, type MapTool } from '@/lib/store/ui-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useGeofenceStore } from '@/lib/store/geofence-store';
import { cn } from '@/lib/utils';

interface ToolDefinition {
  id: MapTool;
  icon: React.ReactNode;
  label: string;
  shortcut: string;
}

const TOOLS: ToolDefinition[] = [
  { id: 'select', icon: <MousePointer2 size={16} />, label: 'Select', shortcut: 'S' },
  { id: 'add-wp', icon: <MapPin size={16} />, label: 'Add WP', shortcut: 'A' },
  { id: 'remove-wp', icon: <Trash2 size={16} />, label: 'Remove WP', shortcut: 'R' },
  { id: 'set-home', icon: <Home size={16} />, label: 'Set Home', shortcut: 'H' },
  { id: 'draw-polygon', icon: <Pentagon size={16} />, label: 'Polygon', shortcut: 'P' },
  { id: 'draw-circle', icon: <Circle size={16} />, label: 'NFZ', shortcut: 'C' },
  { id: 'measure', icon: <Ruler size={16} />, label: 'Measure', shortcut: 'M' },
];

function ToolCountBadge({ count, color }: { count: number; color: 'red' | 'blue' }) {
  return (
    <span
      className={
        'absolute right-0.5 top-0.5 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white ' +
        (color === 'red' ? 'bg-red' : 'bg-blue')
      }
    >
      {count}
    </span>
  );
}

export function MapToolbar() {
  const {
    activeTool, setActiveTool,
    constraintsPanelOpen, toggleConstraintsPanel,
    geofencePanelOpen, toggleGeofencePanel,
    terrainPanelOpen, toggleTerrainPanel,
  } = useUIStore();
  const { nfzs } = useConstraintsStore();
  const { geofences } = useGeofenceStore();

  return (
    <div className="flex w-(--toolbar-width) shrink-0 flex-col items-center gap-0.5 border-r border-border bg-bg-panel py-1.5">
      {TOOLS.map((tool, index) => (
        <div key={tool.id} className="flex w-full flex-col items-center">
          {index === 3 && <div className="my-1 h-px w-8 bg-border" />}
          <button
            className={cn('toolbar-btn relative h-10 w-11 flex-col gap-0.5', activeTool === tool.id && 'active')}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
          >
            {tool.icon}
            <span className="font-sans text-[8px] leading-none text-inherit">
              {tool.label}
            </span>
            {tool.id === 'draw-circle' && nfzs.length > 0 && <ToolCountBadge count={nfzs.length} color="red" />}
          </button>
        </div>
      ))}

      <div className="flex-1" />

      <div className="my-1 h-px w-8 bg-border" />

      <button
        className={cn('toolbar-btn h-10 w-11 flex-col gap-0.5', constraintsPanelOpen && 'active')}
        onClick={toggleConstraintsPanel}
        title="Constraints panel"
        aria-label="Constraints panel"
      >
        <ShieldAlert size={15} />
        <span className="font-sans text-[7px] leading-none">Limits</span>
      </button>

      <button
        className={cn('toolbar-btn relative h-10 w-11 flex-col gap-0.5', geofencePanelOpen && 'active')}
        onClick={toggleGeofencePanel}
        title="Geofences (G)"
        aria-label="Geofences panel"
      >
        <Shield size={15} />
        <span className="font-sans text-[7px] leading-none">Geofence</span>
        {geofences.length > 0 && <ToolCountBadge count={geofences.length} color="blue" />}
      </button>

      <button
        className={cn('toolbar-btn h-10 w-11 flex-col gap-0.5', terrainPanelOpen && 'active')}
        onClick={toggleTerrainPanel}
        title="Terrain profile"
        aria-label="Terrain profile panel"
      >
        <Mountain size={15} />
        <span className="font-sans text-[7px] leading-none">Terrain</span>
      </button>
    </div>
  );
}
