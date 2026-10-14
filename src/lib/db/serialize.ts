/**
 * The Postgres driver returns timestamptz columns as "YYYY-MM-DD HH:MM:SS.ffffff+TZ"
 * (space-separated, not `T`-separated). The rest of the app — localStorage-era
 * zustand stores included — assumes strict ISO-8601 strings (e.g. for
 * `localeCompare`-based chronological sorting), so every timestamp crossing the
 * API boundary is normalized through this function first.
 */
export function toIsoString(value: string | Date): string {
  return new Date(value).toISOString();
}
