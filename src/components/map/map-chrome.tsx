'use client';

import { useState, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Button as AriaButton } from 'react-aria-components';
import { RiAddLine, RiInformationLine, RiLoader4Line, RiSearchLine, RiSubtractLine } from '@remixicon/react';
import { Dropdown, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { FLOAT_PANEL, FOCUS_RING_INSET, LABEL_MONO, MENU_PANEL, SWATCH } from '@/components/editor/editor-styles';
import { useUIStore } from '@/lib/store/ui-store';
import { cx } from '@/utils/cx';

export interface GeoResult {
  label: string;
  lat: number;
  lng: number;
  bbox?: [number, number, number, number]; // [west, south, east, north]
}

/** Geocode through the server proxy (/api/geo/search, cached and rate limited). */
export async function searchPlaces(q: string): Promise<GeoResult[]> {
  const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}&limit=6`);
  if (res.status === 429) throw new Error('Searching too fast. Try again in a moment.');
  if (res.status >= 500) throw new Error('Place search is unavailable right now.');
  if (!res.ok) throw new Error('Search failed. Try a different place name.');
  const data = (await res.json()) as { results?: { name?: string; lat?: number; lng?: number; bbox?: number[] | null }[] };
  return (data.results ?? [])
    .map((r) => ({
      label: String(r.name ?? ''),
      lat: Number(r.lat),
      lng: Number(r.lng),
      bbox: Array.isArray(r.bbox) && r.bbox.length === 4 ? (r.bbox.map(Number) as GeoResult['bbox']) : undefined,
    }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}

const CONTROL = cx(
  'flex size-8 items-center justify-center text-text-secondary transition-colors duration-[120ms] hover:bg-background-primary-hover hover:text-text-primary',
  FOCUS_RING_INSET
);

function MapButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TooltipTrigger delay={300}>
      <AriaButton aria-label={label} onPress={onPress} className={CONTROL}>
        {children}
      </AriaButton>
      <Tooltip placement="left">{label}</Tooltip>
    </TooltipTrigger>
  );
}

function LegendRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex min-h-7 items-center gap-2.5 px-2 text-[13px] text-text-secondary">
      <span aria-hidden className="flex w-6 shrink-0 items-center justify-center">
        <span className={cx('inline-block shrink-0', swatch)} />
      </span>
      {label}
    </div>
  );
}

/** Map chrome (DESIGN_SPEC §5.4): place search top-left; zoom and legend bottom-right.
 * Basemap toggle and Fit route live on the tool rail. */
export function MapChrome({ mapRef }: { mapRef: RefObject<MapLibreMap | null> }) {
  const focusMap = useUIStore((s) => s.focusMap);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const zoom = (delta: number) => {
    const map = mapRef.current;
    if (map) map.easeTo({ zoom: map.getZoom() + delta, duration: 200 });
  };

  const go = (r: GeoResult) => {
    if (r.bbox && (Math.abs(r.bbox[2] - r.bbox[0]) > 0.001 || Math.abs(r.bbox[3] - r.bbox[1]) > 0.001)) {
      focusMap({ kind: 'bounds', bounds: [[r.bbox[0], r.bbox[1]], [r.bbox[2], r.bbox[3]]] });
    } else {
      focusMap({ kind: 'point', point: [r.lng, r.lat] });
    }
    setResults(null);
    setQuery(r.label.split(',')[0]);
  };

  const runSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const found = await searchPlaces(q);
      if (found.length === 0) setSearchError('No places found');
      else if (found.length === 1) go(found[0]);
      else setResults(found.slice(0, 5));
    } catch {
      setSearchError('Search is unavailable right now');
    } finally {
      setSearching(false);
    }
  };

  return (
    <>
      <div className="absolute left-3 top-3 z-10 w-[min(280px,calc(100%-24px))]">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className={cx(FLOAT_PANEL, 'flex h-9 items-center gap-2 px-2.5 focus-within:ring-2 focus-within:ring-border-focus-ring')}
        >
          {searching ? (
            <RiLoader4Line className="size-4 shrink-0 animate-spin text-text-tertiary motion-reduce:animate-none" aria-hidden />
          ) : (
            <RiSearchLine className="size-4 shrink-0 text-text-tertiary" aria-hidden />
          )}
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchError(null);
              if (!e.target.value) setResults(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setResults(null);
            }}
            placeholder="Search for a place"
            aria-label="Search for a place"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-text-primary outline-none placeholder:text-text-placeholder"
          />
        </form>
        {searchError && (
          <p role="status" className={cx(FLOAT_PANEL, 'mt-1 px-2.5 py-1.5 text-[13px] text-text-secondary')}>
            {searchError}
          </p>
        )}
        {results && (
          <ul role="listbox" aria-label="Search results" className={cx(FLOAT_PANEL, 'mt-1 overflow-hidden p-1')}>
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lng},${i}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => go(r)}
                  className="w-full truncate rounded-md px-2.5 py-2 text-start text-[14px] text-text-primary outline-none hover:bg-background-primary-hover focus-visible:bg-background-primary-hover"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="absolute bottom-10 right-3 z-10 flex flex-col gap-2">
        <div className={cx(FLOAT_PANEL, 'flex flex-col divide-y divide-separator-border overflow-hidden')}>
          <MapButton label="Zoom in" onPress={() => zoom(1)}>
            <RiAddLine className="size-4" aria-hidden />
          </MapButton>
          <MapButton label="Zoom out" onPress={() => zoom(-1)}>
            <RiSubtractLine className="size-4" aria-hidden />
          </MapButton>
        </div>
        <div className={cx(FLOAT_PANEL, 'overflow-hidden')}>
          <Dropdown>
            <DropdownTrigger aria-label="Map legend" className={CONTROL}>
              <RiInformationLine className="size-4" aria-hidden />
            </DropdownTrigger>
            <DropdownPopover aria-label="Map legend" placement="left bottom" className={cx('w-[232px]', MENU_PANEL)}>
              <p className={cx(LABEL_MONO, 'px-2 pb-1 pt-1')}>Legend</p>
              <LegendRow swatch={SWATCH.route} label="Route" />
              <LegendRow swatch={SWATCH.routeError} label="Leg with an error" />
              <LegendRow swatch={SWATCH.routeHome} label="Leg to or from home" />
              <LegendRow swatch={SWATCH.waypoint} label="Waypoint" />
              <LegendRow swatch={SWATCH.takeoff} label="Takeoff, home (square), landing (diamond)" />
              <LegendRow swatch={SWATCH.keepOut} label="Keep-out or no-fly zone" />
              <LegendRow swatch={SWATCH.keepIn} label="Keep-in zone" />
              <LegendRow swatch={SWATCH.preview} label="Planner preview" />
            </DropdownPopover>
          </Dropdown>
        </div>
      </div>
    </>
  );
}
