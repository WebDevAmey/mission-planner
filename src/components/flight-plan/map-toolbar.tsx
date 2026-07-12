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
    <div
      style={{
        width: 'var(--toolbar-width)',
        backgroundColor: 'var(--color-bg-panel)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '6px',
        paddingBottom: '6px',
        gap: '2px',
        flexShrink: 0,
      }}
    >
      {TOOLS.map((tool, index) => (
        <div key={tool.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          {index === 3 && (
            <div style={{ width: '32px', height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />
          )}
          <button
            className={`toolbar-btn${activeTool === tool.id ? ' active' : ''}`}
            onClick={() => setActiveTool(tool.id)}
            title={`${tool.label} (${tool.shortcut})`}
            style={{ position: 'relative', width: '44px', height: '40px', flexDirection: 'column', gap: '2px' }}
          >
            {tool.icon}
            <span style={{ fontSize: '8px', lineHeight: 1, color: 'inherit', fontFamily: 'var(--font-sans)' }}>
              {tool.label}
            </span>
            {tool.id === 'draw-circle' && nfzs.length > 0 && (
              <span style={{
                position: 'absolute', top: 2, right: 2,
                backgroundColor: 'var(--color-red)', color: '#fff',
                borderRadius: '50%', width: '12px', height: '12px',
                fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700,
              }}>
                {nfzs.length}
              </span>
            )}
          </button>
        </div>
      ))}

      <div style={{ flex: 1 }} />

      <div style={{ width: '32px', height: '1px', backgroundColor: 'var(--color-border)', margin: '4px 0' }} />

      <button
        className={`toolbar-btn${constraintsPanelOpen ? ' active' : ''}`}
        onClick={toggleConstraintsPanel}
        title="Constraints panel"
        aria-label="Constraints panel"
        style={{ width: '44px', height: '40px', flexDirection: 'column', gap: '2px' }}
      >
        <ShieldAlert size={15} />
        <span style={{ fontSize: '7px', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>Limits</span>
      </button>

      <button
        className={`toolbar-btn${geofencePanelOpen ? ' active' : ''}`}
        onClick={toggleGeofencePanel}
        title="Geofences (G)"
        aria-label="Geofences panel"
        style={{ position: 'relative', width: '44px', height: '40px', flexDirection: 'column', gap: '2px' }}
      >
        <Shield size={15} />
        <span style={{ fontSize: '7px', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>Geofence</span>
        {geofences.length > 0 && (
          <span style={{ position: 'absolute', top: 2, right: 2, backgroundColor: 'var(--color-blue)', color: '#fff', borderRadius: '50%', width: '12px', height: '12px', fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
            {geofences.length}
          </span>
        )}
      </button>

      <button
        className={`toolbar-btn${terrainPanelOpen ? ' active' : ''}`}
        onClick={toggleTerrainPanel}
        title="Terrain profile"
        aria-label="Terrain profile panel"
        style={{ width: '44px', height: '40px', flexDirection: 'column', gap: '2px' }}
      >
        <Mountain size={15} />
        <span style={{ fontSize: '7px', lineHeight: 1, fontFamily: 'var(--font-sans)' }}>Terrain</span>
      </button>
    </div>
  );
}
