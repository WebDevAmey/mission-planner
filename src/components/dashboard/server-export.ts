import type { Issue } from '@/lib/domain/validate';
import type { ExportFormat } from '@/lib/domain/export';
import { downloadBlob } from '@/components/editor/export/exporters';

export type ServerExportResult = { ok: true; filename: string } | { ok: false; issues: Issue[] } | { ok: false; error: string };

/** The server names the backup format `json`; the domain layer calls it `mps`. */
const serverFormat = (f: ExportFormat) => (f === 'mps' ? 'json' : f);

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get('Content-Disposition') ?? '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : fallback;
}

/** GET /api/missions/:id/export. Returns the validation issues on 422 so the
 * caller can offer "Export anyway" (force=1). */
export async function serverExport(id: string, format: ExportFormat, force = false): Promise<ServerExportResult> {
  try {
    const res = await fetch(`/api/missions/${id}/export?format=${serverFormat(format)}${force ? '&force=1' : ''}`);
    if (res.status === 422) {
      const data = (await res.json().catch(() => null)) as { validationIssues?: Issue[] } | null;
      return { ok: false, issues: data?.validationIssues ?? [] };
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: data?.error ?? `Export failed (${res.status})` };
    }
    const filename = filenameFrom(res, `mission.${format}`);
    downloadBlob(await res.blob(), filename);
    return { ok: true, filename };
  } catch {
    return { ok: false, error: 'Could not reach the server' };
  }
}
