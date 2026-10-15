import { EXPORT_FORMATS as CORE_FORMATS, exportMissionFile, type ExportFormat, type ExportedFile } from '@/lib/domain/export';
import type { EditorMission } from '@/lib/store/editor-types';

export type { ExportFormat };

export interface ExportFormatInfo {
  id: ExportFormat;
  label: string;
  ext: string;
  mime: string;
  description: string;
}

/** Menu order: flight-controller formats first, sharing formats, then the backup. */
const ORDER: ExportFormat[] = ['plan', 'waypoints', 'kml', 'geojson', 'csv', 'mps'];

export const EXPORT_FORMATS: ExportFormatInfo[] = ORDER.map((id) => {
  const f = CORE_FORMATS[id];
  return { id, label: f.label, ext: f.extension, mime: f.mimeType, description: f.description };
});

/** Builds an export client-side with the shared domain exporters (same output as the server). */
export function buildExport(format: ExportFormat, mission: EditorMission): ExportedFile {
  const s = mission.settings;
  return exportMissionFile(mission, format, {
    zones: mission.zones.filter((z) => z.enabled),
    cruiseSpeed: s.cruiseSpeed,
    hoverSpeed: s.hoverSpeed,
    constraints: { ...mission.limits, defaultSpeedMs: s.defaultSpeed },
  });
}

export function downloadText(content: string, filename: string, mime: string) {
  downloadBlob(new Blob([content], { type: mime }), filename);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
