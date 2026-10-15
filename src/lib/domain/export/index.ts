import type { Zone } from '@/lib/domain/zones';
import type { MissionPlan } from '@/types/mission';
import { buildCsv } from './csv';
import { slugFilename } from './filename';
import { buildGeoJson, buildKml } from './geo-formats';
import { buildMpsJson, type MpsJsonOptions } from './mps-json';
import { buildQgcPlan, type PlanExportOptions } from './qgc-plan';
import { buildWaypointsFile } from './wpl';

export * from './csv';
export * from './filename';
export * from './geo-formats';
export * from './import';
export * from './mps-json';
export * from './qgc-plan';
export * from './rows';
export * from './wpl';

export type ExportFormat = 'plan' | 'waypoints' | 'kml' | 'geojson' | 'csv' | 'mps';

export interface ExportFormatInfo {
  format: ExportFormat;
  label: string;
  extension: string;
  mimeType: string;
  description: string;
}

export const EXPORT_FORMATS: Record<ExportFormat, ExportFormatInfo> = {
  plan: { format: 'plan', label: 'QGroundControl (.plan)', extension: 'plan', mimeType: 'application/json', description: 'QGroundControl and Mission Planner, incl. geofence and rally points' },
  waypoints: { format: 'waypoints', label: 'Mission Planner (.waypoints)', extension: 'waypoints', mimeType: 'text/plain', description: 'QGC WPL 110 for Mission Planner and MAVProxy' },
  kml: { format: 'kml', label: 'Google Earth (.kml)', extension: 'kml', mimeType: 'application/vnd.google-earth.kml+xml', description: 'Route, waypoints and zones for sharing' },
  geojson: { format: 'geojson', label: 'GeoJSON', extension: 'geojson', mimeType: 'application/geo+json', description: 'For GIS tools' },
  csv: { format: 'csv', label: 'Spreadsheet (.csv)', extension: 'csv', mimeType: 'text/csv', description: 'One row per item for review' },
  mps: { format: 'mps', label: 'Flight Deck (.json)', extension: 'json', mimeType: 'application/json', description: 'Full re-importable backup' },
};

export interface ExportOptions extends PlanExportOptions, Omit<MpsJsonOptions, 'zones'> {
  zones?: Zone[];
}

export interface ExportedFile {
  content: string;
  filename: string;
  mimeType: string;
  extension: string;
}

/** Build any export format; pure apart from the default timestamp (pass `now` to pin it). */
export function exportMissionFile(mission: MissionPlan, format: ExportFormat, opts: ExportOptions = {}): ExportedFile {
  const info = EXPORT_FORMATS[format];
  const content = (() => {
    switch (format) {
      case 'plan':
        return buildQgcPlan(mission, opts);
      case 'waypoints':
        return buildWaypointsFile(mission);
      case 'kml':
        return buildKml(mission, opts.zones);
      case 'geojson':
        return buildGeoJson(mission, opts.zones);
      case 'csv':
        return buildCsv(mission);
      case 'mps':
        return buildMpsJson(mission, opts);
    }
  })();
  return { content, filename: slugFilename(mission.name, info.extension, opts.now), mimeType: info.mimeType, extension: info.extension };
}
