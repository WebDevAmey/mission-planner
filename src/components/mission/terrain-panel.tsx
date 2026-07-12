'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshCw, Mountain } from 'lucide-react';
import { useMissionStore } from '@/lib/store/mission-store';
import { useConstraintsStore } from '@/lib/store/constraints-store';
import { useUIStore } from '@/lib/store/ui-store';
import { supportsCoordinates } from '@/lib/mavlink/commands';
import {
  getElevations,
  clearElevationCache,
  buildTerrainSamplePoints,
  getGroundClearance,
} from '@/lib/services/terrain-service';
import { round7 } from '@/lib/utils';

interface SamplePoint {
  distFromStart: number;
  lat: number;
  lng: number;
  terrainElev: number | null;
  flightAlt: number | null;
}

export function TerrainPanel() {
  const { mission } = useMissionStore();
  const { config, updateConfig } = useConstraintsStore();
  const { addToast } = useUIStore();

  const [samples, setSamples] = useState<SamplePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spatialItems = mission?.items.filter(
    (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
  ) ?? [];

  const fetchTerrain = useCallback(async (force = false) => {
    const spatial = mission?.items.filter(
      (i) => supportsCoordinates(i.action) && i.latitude !== null && i.longitude !== null
    ) ?? [];
    if (spatial.length === 0) { setSamples([]); return; }
    if (force) clearElevationCache();

    setLoading(true);
    const rawSamples = buildTerrainSamplePoints(
      spatial.map((i) => ({
        latitude: i.latitude!,
        longitude: i.longitude!,
        altitude: i.altitude,
      }))
    );

    try {
      const elevs = await getElevations(rawSamples.map((p) => ({ lat: p.lat, lng: p.lng })));
      const built: SamplePoint[] = rawSamples.map((p, idx) => ({
        ...p,
        terrainElev: elevs[idx] ?? null,
        flightAlt: null,
      }));

      // Interpolate flight altitudes at sample positions
      let wpIdx = 0;
      for (let i = 0; i < built.length; i++) {
        const s = built[i];
        const matchingWp = spatial.find((wp) => round7(wp.latitude!) === round7(s.lat) && round7(wp.longitude!) === round7(s.lng));
        if (matchingWp) {
          s.flightAlt = matchingWp.altitude;
          wpIdx = spatial.indexOf(matchingWp);
        } else {
          const a = spatial[wpIdx];
          const b = spatial[Math.min(wpIdx + 1, spatial.length - 1)];
          s.flightAlt = ((a.altitude ?? 0) + (b.altitude ?? 0)) / 2;
        }
      }
      setSamples(built);
    } catch {
      addToast('Terrain data unavailable — working offline', 'warning');
      setSamples([]);
    } finally {
      setLoading(false);
    }
  }, [spatialItems, addToast]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchTerrain(false), 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mission?.updatedAt]);

  const W = 540;
  const H = 180;
  const PAD = { left: 40, right: 12, top: 12, bottom: 30 };

  const maxDist = samples.length > 0 ? Math.max(...samples.map((s) => s.distFromStart)) : 1;
  const allElev = samples.flatMap((s) => [s.terrainElev ?? 0, s.flightAlt ?? 0]);
  const minY = Math.min(...allElev);
  const maxY = Math.max(...allElev) + 20;

  const xScale = (d: number) =>
    PAD.left + ((d / maxDist) * (W - PAD.left - PAD.right));
  const yScale = (v: number) =>
    H - PAD.bottom - ((v - minY) / (maxY - minY || 1)) * (H - PAD.top - PAD.bottom);

  const terrainPath =
    samples.length > 1
      ? samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(s.distFromStart)},${yScale(s.terrainElev ?? 0)}`).join(' ')
      : '';
  const flightPath =
    samples.length > 1
      ? samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(s.distFromStart)},${yScale(s.flightAlt ?? 0)}`).join(' ')
      : '';

  // Check for conflicts
  const hasConflict = samples.some((s) => {
    if (s.terrainElev === null || s.flightAlt === null) return false;
    return getGroundClearance(s.flightAlt, s.terrainElev) < config.minAGLClearance;
  });

  const hoverSample = hover !== null ? samples[hover] : null;

  return (
    <div style={{
      backgroundColor: '#0d0d0d',
      borderTop: '1px solid var(--color-border-mid)',
      flexShrink: 0,
      padding: '6px 12px 8px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Mountain size={12} color="var(--color-text-muted)" />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Terrain Profile
          </span>
          {hasConflict && (
            <span className="badge badge-red">TERRAIN CONFLICT</span>
          )}
          {loading && (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>Loading…</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            Min AGL (m)
            <input
              type="number"
              value={config.minAGLClearance}
              onChange={(e) => updateConfig({ minAGLClearance: parseFloat(e.target.value) || 0 })}
              style={{
                width: '40px', padding: '1px 3px', backgroundColor: 'var(--color-bg-raised)',
                border: '1px solid var(--color-border-mid)', borderRadius: '2px',
                color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: '9px', outline: 'none',
              }}
            />
          </label>
          <button onClick={() => fetchTerrain(true)}
            aria-label="Refresh terrain data"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', display: 'flex', gap: '3px', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '9px' }}>
            <RefreshCw size={11} /> Refresh
          </button>
        </div>
      </div>

      {/* SVG Chart */}
      {samples.length > 0 ? (
        <div style={{ position: 'relative' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ display: 'block', cursor: 'crosshair' }}
            onMouseMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mx = ((e.clientX - rect.left) / rect.width) * W;
              const dist = ((mx - PAD.left) / (W - PAD.left - PAD.right)) * maxDist;
              const closest = samples.reduce((best, s, i) =>
                Math.abs(s.distFromStart - dist) < Math.abs((samples[best]?.distFromStart ?? 0) - dist) ? i : best, 0);
              setHover(closest);
            }}
            onMouseLeave={() => setHover(null)}
          >
            {/* Fill: safe clearance */}
            {samples.length > 1 && (
              <path
                d={`${terrainPath} L${xScale(samples[samples.length - 1].distFromStart)},${yScale(samples[samples.length - 1].flightAlt ?? 0)} ${flightPath.split(' ').slice(1).reverse().join(' ')} Z`}
                fill={hasConflict ? 'rgba(255,51,51,0.15)' : 'rgba(0,255,65,0.1)'}
              />
            )}

            {/* Terrain line */}
            {terrainPath && (
              <path d={terrainPath} fill="none" stroke="rgba(255,170,0,0.8)" strokeWidth="1.5" />
            )}

            {/* Flight path */}
            {flightPath && (
              <path d={flightPath} fill="none" stroke="var(--color-green)" strokeWidth="1.5" />
            )}

            {/* Waypoint vertical lines */}
            {spatialItems.map((item, idx) => {
              const match = samples.find(
                (s) => round7(s.lat) === round7(item.latitude!) && round7(s.lng) === round7(item.longitude!)
              );
              if (!match) return null;
              const x = xScale(match.distFromStart);
              return (
                <line key={idx} x1={x} y1={PAD.top} x2={x} y2={H - PAD.bottom}
                  stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2,2" />
              );
            })}

            {/* Crosshair */}
            {hover !== null && samples[hover] && (
              <line
                x1={xScale(samples[hover].distFromStart)} y1={PAD.top}
                x2={xScale(samples[hover].distFromStart)} y2={H - PAD.bottom}
                stroke="rgba(255,255,255,0.4)" strokeWidth="1"
              />
            )}

            {/* Y-axis labels */}
            {[minY, (minY + maxY) / 2, maxY].map((v, i) => (
              <text key={i} x={PAD.left - 4} y={yScale(v) + 3}
                textAnchor="end" fill="rgba(255,255,255,0.4)"
                style={{ fontFamily: 'monospace', fontSize: '9px' }}>
                {Math.round(v)}
              </text>
            ))}

            {/* X-axis distance label */}
            <text x={W - PAD.right} y={H - 6} textAnchor="end"
              fill="rgba(255,255,255,0.3)" style={{ fontFamily: 'monospace', fontSize: '9px' }}>
              {Math.round(maxDist)}m
            </text>
          </svg>

          {/* Hover tooltip */}
          {hoverSample && hover !== null && (
            <div style={{
              position: 'absolute',
              left: `${(xScale(hoverSample.distFromStart) / W) * 100}%`,
              top: 0,
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(10,10,10,0.9)',
              border: '1px solid var(--color-border-mid)',
              borderRadius: '3px',
              padding: '4px 6px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              color: 'var(--color-text)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
            }}>
              <div>{Math.round(hoverSample.distFromStart)}m from start</div>
              <div style={{ color: 'var(--color-amber)' }}>Terrain: {Math.round(hoverSample.terrainElev ?? 0)}m AMSL</div>
              <div style={{ color: 'var(--color-green)' }}>Flight: {Math.round(hoverSample.flightAlt ?? 0)}m</div>
              <div style={{ color: hoverSample.flightAlt !== null && hoverSample.terrainElev !== null && getGroundClearance(hoverSample.flightAlt, hoverSample.terrainElev) < config.minAGLClearance ? 'var(--color-red)' : 'var(--color-text-muted)' }}>
                AGL: {hoverSample.flightAlt !== null && hoverSample.terrainElev !== null ? Math.round(getGroundClearance(hoverSample.flightAlt, hoverSample.terrainElev)) : '—'}m
              </div>
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '2px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
              <div style={{ width: '14px', height: '2px', background: 'var(--color-green)' }} /> Flight path
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)' }}>
              <div style={{ width: '14px', height: '2px', background: 'rgba(255,170,0,0.8)' }} /> Terrain
            </div>
          </div>
        </div>
      ) : (
        <div style={{ height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
          {spatialItems.length < 2 ? 'Add at least 2 waypoints to see terrain profile' : loading ? 'Fetching terrain…' : 'No data'}
        </div>
      )}
    </div>
  );
}
