'use client';

import { useEffect, useRef, useState } from 'react';
import { missionLegs } from '@/lib/domain/mission';
import type { LngLat } from '@/lib/domain/geo';
import type { MissionPlan } from '@/types/mission';

type Route = { path: LngLat[]; home: LngLat | null };

const cache = new Map<string, Promise<Route | null>>();

/** Route geometry for a card. The list API has no geometry, so each visible card
 * fetches its mission once (cached per version). */
function loadRoute(id: string, version: number): Promise<Route | null> {
  const key = `${id}@${version}`;
  let p = cache.get(key);
  if (!p) {
    p = fetch(`/api/missions/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mission?: MissionPlan } | null) => {
        if (!d?.mission) return null;
        const legs = missionLegs(d.mission);
        const h = d.mission.homePosition;
        return {
          path: legs.length ? [legs[0].a, ...legs.map((l) => l.b)] : [],
          home: h ? ([h.longitude, h.latitude] as LngLat) : null,
        };
      })
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

const W = 320;
const H = 140;
const PAD = 16;

function project(points: LngLat[]) {
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  const midLat = ((Math.min(...lats) + Math.max(...lats)) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat);
  const minX = Math.min(...lngs) * kx;
  const maxX = Math.max(...lngs) * kx;
  const minY = Math.min(...lats);
  const maxY = Math.max(...lats);
  const s = Math.min((W - 2 * PAD) / Math.max(maxX - minX, 1e-9), (H - 2 * PAD) / Math.max(maxY - minY, 1e-9));
  const ox = (W - (maxX - minX) * s) / 2;
  const oy = (H - (maxY - minY) * s) / 2;
  return (p: LngLat) => [ox + (p[0] * kx - minX) * s, H - (oy + (p[1] - minY) * s)] as const;
}

/** Route thumbnail (SVG, token colours). */
export function MissionThumbnail({ id, version, hasGeometry }: { id: string; version: number; hasGeometry: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [route, setRoute] = useState<Route | null>(null);

  useEffect(() => {
    if (!hasGeometry || !ref.current) return;
    let cancelled = false;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      void loadRoute(id, version).then((r) => {
        if (!cancelled) setRoute(r);
      });
    });
    io.observe(ref.current);
    return () => {
      cancelled = true;
      io.disconnect();
    };
  }, [id, version, hasGeometry]);

  const pts = route ? [...route.path, ...(route.home ? [route.home] : [])] : [];
  const proj = pts.length ? project(pts) : null;

  return (
    <div ref={ref} className="relative h-[140px] overflow-hidden rounded-lg bg-background-secondary-default" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="size-full">
        <defs>
          <pattern id="mp-grid" width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" className="fill-none stroke-separator-border" strokeWidth={1} />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#mp-grid)" />
        {proj && route && route.path.length >= 2 && (
          <polyline
            points={route.path.map((p) => proj(p).join(',')).join(' ')}
            className="fill-none stroke-accent-600"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {proj &&
          route?.path.slice(1).map((p, i) => {
            const [x, y] = proj(p);
            return <circle key={i} cx={x} cy={y} r={2.5} className="fill-background-primary-default stroke-accent-600" strokeWidth={1.5} />;
          })}
        {proj && route?.home && (
          <rect x={proj(route.home)[0] - 4} y={proj(route.home)[1] - 4} width={8} height={8} rx={2} className="fill-text-primary" />
        )}
      </svg>
      {!hasGeometry && (
        <span className="absolute inset-0 flex items-center justify-center text-caption-1-regular text-text-tertiary">No route yet</span>
      )}
    </div>
  );
}
