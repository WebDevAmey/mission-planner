'use client';

import { useState } from 'react';
import { RiCheckLine, RiMapPinLine, RiSearchLine } from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Input } from '@/components/base/input/input';
import { AppDialog } from '@/components/app-shell/app-dialog';
import { MISSION_TEMPLATES } from '@/lib/templates/mission-templates';
import { searchPlaces, type GeoResult } from '@/components/map/map-chrome';
import { EXPORT_FORMATS, type ExportFormatInfo } from '@/components/editor/export/exporters';
import { SelectField } from '@/components/editor/fields';
import { cx } from '@/utils/cx';
import type { MissionSummary } from './types';

/* ------------------------------------------------------------ new mission */

export interface NewMissionInput {
  name: string;
  template: string;
  home: { latitude: number; longitude: number; altitude: number } | null;
}

export function NewMissionDialog({
  open,
  busy,
  onClose,
  onCreate,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: NewMissionInput) => void;
}) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState('blank');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeoResult[] | null>(null);
  const [place, setPlace] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const needsHome = template !== 'blank';
  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      setResults(await searchPlaces(query.trim()));
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  };
  const locate = () => {
    if (!navigator.geolocation) {
      setSearchError('Location is not available in this browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setPlace({ label: 'Current location', lat: p.coords.latitude, lng: p.coords.longitude }),
      () => setSearchError('Location permission was denied'),
      { timeout: 8000 }
    );
  };

  const submit = () =>
    onCreate({
      name: name.trim(),
      template,
      home: place ? { latitude: place.lat, longitude: place.lng, altitude: 0 } : null,
    });

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      busy={busy}
      title="New mission"
      description="Start blank or from a template. You can change everything later."
      footer={
        <>
          <Button size="small" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="small" variant="primary" disabled={busy || (needsHome && !place)} onClick={submit}>
            {busy ? 'Creating…' : 'Create mission'}
          </Button>
        </>
      }
    >
      <Input label="Name" placeholder="Untitled mission" value={name} onChange={setName} autoFocus />
      <div className="flex flex-col gap-1.5">
        <SelectField
          label="Start from"
          value={template}
          options={MISSION_TEMPLATES.map((t) => ({ value: t.id, label: t.name }))}
          onChange={setTemplate}
        />
        <p className="text-caption-1-regular text-text-secondary text-pretty">{MISSION_TEMPLATES.find((t) => t.id === template)?.description}</p>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-body-2-medium text-text-primary">
          Location{needsHome ? '' : <span className="font-normal text-text-tertiary"> (optional)</span>}
        </span>
        {place ? (
          <div className="flex items-center gap-2 rounded-md border border-separator-border bg-background-secondary-default py-1.5 ps-3 pe-1.5">
            <RiCheckLine className="size-4 shrink-0 text-text-secondary" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-body-2-regular text-text-primary">{place.label}</span>
            <Button size="xs" variant="ghost" onClick={() => setPlace(null)}>
              Change
            </Button>
          </div>
        ) : (
          <>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void search();
              }}
            >
              <Input
                aria-label="Search for a place"
                placeholder="Search a place or address"
                leadingIcon={RiSearchLine}
                value={query}
                onChange={setQuery}
                className="flex-1"
              />
              <Button type="submit" size="medium" variant="secondary" disabled={searching || !query.trim()}>
                {searching ? 'Searching…' : 'Search'}
              </Button>
            </form>
            <Button size="small" variant="ghost" leadingIcon={RiMapPinLine} onClick={locate} className="self-start">
              Use my location
            </Button>
            {searchError && <p className="text-caption-1-regular text-(color:--fd-danger)">{searchError}</p>}
            {results && (
              <ul className="flex max-h-40 flex-col overflow-y-auto rounded-md border border-separator-border" aria-label="Search results">
                {results.length === 0 && <li className="px-3 py-2 text-body-2-regular text-text-secondary">No places found</li>}
                {results.map((r, i) => (
                  <li key={i} className="border-b border-separator-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => {
                        setPlace({ label: r.label, lat: r.lat, lng: r.lng });
                        setResults(null);
                      }}
                      className="w-full truncate px-3 py-2 text-start text-body-2-regular text-text-primary outline-none hover:bg-background-secondary-default focus-visible:bg-background-secondary-default"
                    >
                      {r.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        {needsHome && !place && <p className="text-caption-1-regular text-text-tertiary">Templates are placed around this location.</p>}
      </div>
    </AppDialog>
  );
}

/* ------------------------------------------------------------ rename */

export function RenameDialog({
  mission,
  onClose,
  onRename,
}: {
  mission: MissionSummary | null;
  onClose: () => void;
  onRename: (m: MissionSummary, name: string) => void;
}) {
  const [name, setName] = useState(mission?.name ?? '');
  const valid = name.trim().length > 0 && name.trim().length <= 200;
  return (
    <AppDialog
      open={!!mission}
      onClose={onClose}
      title="Rename mission"
      onSubmit={() => {
        if (mission && valid) onRename(mission, name.trim());
      }}
      footer={
        <>
          <Button type="button" size="small" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="small" variant="primary" disabled={!valid}>
            Rename
          </Button>
        </>
      }
    >
      <Input label="Name" value={name} onChange={setName} autoFocus isInvalid={!valid} hint={valid ? undefined : 'Enter a name'} />
    </AppDialog>
  );
}

/* ------------------------------------------------------------ delete */

export function DeleteDialog({
  mission,
  busy,
  onClose,
  onConfirm,
}: {
  mission: MissionSummary | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: (m: MissionSummary) => void;
}) {
  return (
    <AppDialog
      open={!!mission}
      onClose={onClose}
      busy={busy}
      tone="danger"
      title={<>Delete “{mission?.name}”?</>}
      description="The mission, its waypoints and zones are removed permanently. This cannot be undone."
      footer={
        <>
          <Button size="small" variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button size="small" variant="danger" disabled={busy} onClick={() => mission && onConfirm(mission)}>
            {busy ? 'Deleting…' : 'Delete mission'}
          </Button>
        </>
      }
    />
  );
}

/* ------------------------------------------------------------ export */

export function ExportDialog({
  mission,
  busy,
  onClose,
  onPick,
}: {
  mission: MissionSummary | null;
  busy: boolean;
  onClose: () => void;
  onPick: (m: MissionSummary, f: ExportFormatInfo) => void;
}) {
  return (
    <AppDialog open={!!mission} onClose={onClose} busy={busy} title={<>Export “{mission?.name}”</>} description="Pick a file format. The download starts right away.">
      <ul className="-mx-2 flex flex-col">
        {EXPORT_FORMATS.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => mission && onPick(mission, f)}
              className={cx(
                'flex w-full items-start gap-3 rounded-md px-2 py-2 text-start outline-none transition-colors duration-150',
                'hover:bg-background-secondary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:opacity-50'
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-body-2-medium text-text-primary">{f.label}</span>
                <span className="text-caption-1-regular text-text-secondary">{f.description}</span>
              </span>
              <span className="shrink-0 pt-0.5 font-mono text-caption-1-regular text-text-tertiary">.{f.ext}</span>
            </button>
          </li>
        ))}
      </ul>
    </AppDialog>
  );
}
