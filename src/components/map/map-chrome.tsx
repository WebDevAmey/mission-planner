'use client';

import { useState, type RefObject } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { Button as AriaButton } from 'react-aria-components';
import {
  RiAddLine,
  RiFocus3Line,
  RiLoader4Line,
  RiSearchLine,
  RiStackLine,
  RiSubtractLine,
} from '@remixicon/react';
import { Dropdown, DropdownGroup, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { SegmentedControl, SegmentedControlItem } from '@/components/base/segmented-control/segmented-control';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
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
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
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

const CONTROL =
  'flex size-9 items-center justify-center bg-background-primary-default text-foreground-icon-primary outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring';

function MapButton({ label, onPress, children }: { label: string; onPress: () => void; children: React.ReactNode }) {
  return (
    <TooltipTrigger>
      <AriaButton aria-label={label} onPress={onPress} className={CONTROL}>
        {children}
      </AriaButton>
      <Tooltip placement="left">{label}</Tooltip>
    </TooltipTrigger>
  );
}

function LegendRow({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-body-2-regular text-text-secondary">
      <span aria-hidden className={cx('inline-block shrink-0', swatch)} />
      {label}
    </div>
  );
}

/** Map chrome per PRODUCT_SPEC §6.2: search top-left; zoom / fit / layers bottom-right. */
export function MapChrome({ mapRef }: { mapRef: RefObject<MapLibreMap | null> }) {
  const mapStyle = useUIStore((s) => s.mapStyle);
  const setMapStyle = useUIStore((s) => s.setMapStyle);
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
      <div className="absolute left-3 top-3 z-10 w-[min(300px,calc(100%-24px))]">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
          className="flex h-9 items-center gap-2 rounded-2lg border border-border-button-default bg-background-primary-default px-2.5 shadow-dropdown focus-within:ring-2 focus-within:ring-border-focus-ring"
        >
          {searching ? (
            <RiLoader4Line className="size-4 shrink-0 animate-spin text-foreground-icon-secondary" aria-hidden />
          ) : (
            <RiSearchLine className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
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
            className="min-w-0 flex-1 bg-transparent text-body-2-regular text-text-primary outline-none placeholder:text-text-placeholder"
          />
        </form>
        {searchError && (
          <p role="status" className="mt-1 rounded-lg bg-background-primary-default px-2.5 py-1.5 text-caption-1-medium text-text-secondary shadow-dropdown">
            {searchError}
          </p>
        )}
        {results && (
          <ul role="listbox" aria-label="Search results" className="mt-1 overflow-hidden rounded-2lg border border-border-button-default bg-background-primary-default p-1 shadow-dropdown">
            {results.map((r, i) => (
              <li key={`${r.lat},${r.lng},${i}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => go(r)}
                  className="w-full truncate rounded-lg px-2.5 py-2 text-start text-body-2-regular text-text-primary outline-none hover:bg-dropdown-item-hover-background focus-visible:bg-dropdown-item-hover-background"
                >
                  {r.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="absolute bottom-10 right-3 z-10 flex flex-col gap-2">
        <div className="flex flex-col divide-y divide-border-button-default overflow-hidden rounded-2lg border border-border-button-default shadow-dropdown">
          <MapButton label="Zoom in" onPress={() => zoom(1)}>
            <RiAddLine className="size-5" aria-hidden />
          </MapButton>
          <MapButton label="Zoom out" onPress={() => zoom(-1)}>
            <RiSubtractLine className="size-5" aria-hidden />
          </MapButton>
        </div>
        <div className="flex flex-col divide-y divide-border-button-default overflow-hidden rounded-2lg border border-border-button-default shadow-dropdown">
          <MapButton label="Fit mission" onPress={() => focusMap({ kind: 'route' })}>
            <RiFocus3Line className="size-5" aria-hidden />
          </MapButton>
          <Dropdown>
            <DropdownTrigger aria-label="Layers and legend" className={CONTROL}>
              <RiStackLine className="size-5" aria-hidden />
            </DropdownTrigger>
            <DropdownPopover aria-label="Layers" placement="left bottom" className="w-[240px]">
              <DropdownGroup label="Basemap">
                <SegmentedControl
                  aria-label="Basemap"
                  selectedKeys={new Set([mapStyle])}
                  onSelectionChange={(keys) => {
                    const k = [...keys][0] as 'vector' | 'satellite' | undefined;
                    if (k) setMapStyle(k);
                  }}
                  className="w-full"
                >
                  <SegmentedControlItem id="vector" className="flex-1">
                    Map
                  </SegmentedControlItem>
                  <SegmentedControlItem id="satellite" className="flex-1">
                    Satellite
                  </SegmentedControlItem>
                </SegmentedControl>
              </DropdownGroup>
              <DropdownGroup label="Legend">
                <LegendRow swatch="h-1 w-6 rounded-full bg-cyan" label="Route" />
                <LegendRow swatch="h-1 w-6 rounded-full bg-red" label="Leg with an error" />
                <LegendRow swatch="h-0 w-6 border-t-2 border-dashed border-cyan" label="Return to home" />
                <LegendRow swatch="size-3 rounded-sm border-2 border-dashed border-red bg-red-bg" label="Keep-out / no-fly zone" />
                <LegendRow swatch="size-3 rounded-sm border-2 border-dashed border-blue bg-blue-bg" label="Keep-in zone" />
                <LegendRow swatch="h-0 w-6 border-t-2 border-dashed border-green" label="Planner preview" />
              </DropdownGroup>
            </DropdownPopover>
          </Dropdown>
        </div>
      </div>
    </>
  );
}
