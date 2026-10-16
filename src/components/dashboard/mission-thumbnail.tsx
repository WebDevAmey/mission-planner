'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { missionLegs } from '@/lib/domain/mission';
import type { LngLat } from '@/lib/domain/geo';
import type { MissionPlan } from '@/types/mission';
import { cx } from '@/utils/cx';

/** `path` is the flown route (takeoff first); `rtl` is true when it ends with a return to launch. */
type Route = { path: LngLat[]; home: LngLat | null; rtl: boolean };

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
        const rtl = legs.length > 0 && legs[legs.length - 1].to === null;
        const flown = rtl ? legs.slice(0, -1) : legs;
        return {
          path: flown.length ? [flown[0].a, ...flown.map((l) => l.b)] : legs.length ? [legs[0].a] : [],
          home: h ? ([h.longitude, h.latitude] as LngLat) : null,
          rtl,
        };
      })
      .catch(() => null);
    cache.set(key, p);
  }
  return p;
}

const W = 320;
const H = 150;
const PAD = 22;

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

/** Map-paper backdrop: faint graticule on the inset tone. */
function Graticule({ id }: { id: string }) {
  return (
    <>
      <defs>
        <pattern id={id} width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" className="fill-none stroke-separator-border" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#${id})`} />
    </>
  );
}

/** Route thumbnail on map paper (SVG, token colours). Route in accent, takeoff = square, RTL = diamond + dashed return. */
export function MissionThumbnail({
  id,
  version,
  hasGeometry,
  className,
}: {
  id: string;
  version: number;
  hasGeometry: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gridId = `fd-grat-${useId().replace(/:/g, '')}`;
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
  const line = proj && route && route.path.length >= 2 ? route.path.map((p) => proj(p).join(',')).join(' ') : null;
  const takeoff = proj && route ? (route.home ?? route.path[0] ?? null) : null;
  const last = route?.path[route.path.length - 1];

  return (
    <div ref={ref} className={cx('relative aspect-[32/15] overflow-hidden bg-background-secondary-default', className)} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="size-full" preserveAspectRatio="xMidYMid slice">
        <Graticule id={gridId} />
        {proj && route?.rtl && route.home && last && (
          <line
            x1={proj(last)[0]}
            y1={proj(last)[1]}
            x2={proj(route.home)[0]}
            y2={proj(route.home)[1]}
            className="stroke-text-tertiary"
            strokeWidth={1.25}
            strokeDasharray="3 3"
          />
        )}
        {line && (
          <>
            <polyline points={line} className="fill-none stroke-background-primary-default" strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={line} className="fill-none stroke-fd-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          </>
        )}
        {proj &&
          route?.path.slice(1, route.rtl ? -1 : undefined).map((p, i) => {
            const [x, y] = proj(p);
            return <circle key={i} cx={x} cy={y} r={2.75} className="fill-background-primary-default stroke-text-primary" strokeWidth={1.25} />;
          })}
        {proj && route?.rtl && last && route.path.length > 1 && (
          <rect
            x={proj(last)[0] - 3.5}
            y={proj(last)[1] - 3.5}
            width={7}
            height={7}
            transform={`rotate(45 ${proj(last)[0]} ${proj(last)[1]})`}
            className="fill-text-primary"
          />
        )}
        {proj && takeoff && <rect x={proj(takeoff)[0] - 4} y={proj(takeoff)[1] - 4} width={8} height={8} className="fill-text-primary" />}
      </svg>
      {!hasGeometry && (
        <span className="absolute inset-0 flex items-center justify-center text-caption-1-regular text-text-tertiary">No waypoints yet</span>
      )}
    </div>
  );
}
