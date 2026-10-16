import { MissionImportError, parseMissionFile } from '@/lib/domain/export';
import { toWaypointInput } from '@/lib/missions/payload';
import {
  MAX_MISSION_ITEMS,
  MAX_MISSION_ZONES,
  homeSchema,
  missionSettingsInputSchema,
  waypointInputSchema,
  zoneInputSchema,
} from '@/lib/validation/mission';
import { apiError, authorize, readBodyBytes, readJsonBody, validationError } from '@/lib/http/api';
import { toMissionPlan, DEFAULT_SETTINGS } from '@/lib/missions/map';
import { asDbMission, createMissionDocument, loadFullMission, type SettingsInput } from '@/lib/missions/repo';
import { z } from 'zod';

const MAX_IMPORT_BYTES = 1024 * 1024;

const jsonBodySchema = z.object({
  filename: z.string().trim().min(1).max(255),
  content: z.string().min(1),
  name: z.string().trim().min(1).max(200).optional(),
});

async function readUpload(request: Request): Promise<{ filename: string; content: string; name?: string } | Response> {
  const declared = Number(request.headers.get('content-length') ?? '');
  // Multipart framing adds a little; allow some slack over the file cap.
  if (Number.isFinite(declared) && declared > MAX_IMPORT_BYTES + 16 * 1024) {
    return apiError(413, 'PAYLOAD_TOO_LARGE', 'Import files are limited to 1 MB');
  }

  const type = request.headers.get('content-type') ?? '';
  if (type.startsWith('multipart/form-data')) {
    // Capped while streaming: a chunked upload has no Content-Length to check up front.
    const bytes = await readBodyBytes(request, MAX_IMPORT_BYTES + 16 * 1024);
    if (bytes === 'too_large') return apiError(413, 'PAYLOAD_TOO_LARGE', 'Import files are limited to 1 MB');
    if (bytes === null) return apiError(400, 'INVALID_BODY', 'Could not read the uploaded file');
    let form: FormData;
    try {
      form = await new Response(bytes, { headers: { 'content-type': type } }).formData();
    } catch {
      return apiError(400, 'INVALID_BODY', 'Could not read the uploaded file');
    }
    const file = form.get('file');
    if (!(file instanceof File)) return apiError(400, 'VALIDATION_FAILED', 'file: attach a .plan, .waypoints or .json file');
    if (file.size > MAX_IMPORT_BYTES) return apiError(413, 'PAYLOAD_TOO_LARGE', 'Import files are limited to 1 MB');
    const name = form.get('name');
    return { filename: file.name || 'mission', content: await file.text(), name: typeof name === 'string' && name.trim() ? name.trim() : undefined };
  }

  const body = await readJsonBody(request, { maxBytes: MAX_IMPORT_BYTES + 4 * 1024 });
  if (!body.ok) return body.response;
  const parsed = jsonBodySchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);
  if (Buffer.byteLength(parsed.data.content, 'utf8') > MAX_IMPORT_BYTES) {
    return apiError(413, 'PAYLOAD_TOO_LARGE', 'Import files are limited to 1 MB');
  }
  return parsed.data;
}

/**
 * POST /api/missions/import — multipart `file` (+ optional `name`), or JSON `{ filename, content, name? }`.
 * Accepts QGC `.plan`, `QGC WPL 110` `.waypoints` and Flight Deck `.json` (1 MB max).
 * → 201 `{ ok, mission, warnings: string[] }` · 400 with field/line detail · 413 too large.
 */
export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const upload = await readUpload(request);
  if (upload instanceof Response) return upload;

  let imported;
  try {
    imported = parseMissionFile(upload.filename, upload.content, DEFAULT_SETTINGS);
  } catch (err) {
    if (err instanceof MissionImportError) return apiError(400, 'VALIDATION_FAILED', err.message);
    return apiError(400, 'VALIDATION_FAILED', 'Could not read this mission file');
  }

  if (imported.items.length > MAX_MISSION_ITEMS) {
    return apiError(413, 'PAYLOAD_TOO_LARGE', `A mission can hold at most ${MAX_MISSION_ITEMS} items`);
  }

  const items = [];
  for (const [i, item] of imported.items.entries()) {
    const parsed = waypointInputSchema.safeParse(toWaypointInput(item, i));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return apiError(400, 'VALIDATION_FAILED', `Item ${i + 1}: ${issue?.path.join('.')} ${issue?.message ?? 'is invalid'}`, {
        issues: parsed.error.issues.map((x) => ({ path: `items.${i}.${x.path.join('.')}`, message: x.message })),
      });
    }
    items.push(parsed.data);
  }

  const warnings = [...imported.warnings];
  const zones = [];
  for (const [i, zone] of imported.zones.slice(0, MAX_MISSION_ZONES).entries()) {
    const parsed = zoneInputSchema.safeParse(zone);
    if (parsed.success) zones.push(parsed.data);
    else warnings.push(`Zone ${i + 1} skipped: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }
  if (imported.zones.length > MAX_MISSION_ZONES) warnings.push(`Only the first ${MAX_MISSION_ZONES} zones were imported`);

  // Home and settings come straight from the file: validate them like any other input.
  let home = null;
  if (imported.homePosition) {
    const parsedHome = homeSchema.safeParse(imported.homePosition);
    if (parsedHome.success) home = parsedHome.data;
    else warnings.push('The home position in the file is invalid and was ignored');
  }

  const s = imported.settings;
  let settings: SettingsInput | undefined;
  if (s) {
    const pick = (key: keyof typeof DEFAULT_SETTINGS & keyof SettingsInput) => {
      const field = missionSettingsInputSchema.shape[key].safeParse(s[key as keyof typeof s]);
      return field.success ? field.data : DEFAULT_SETTINGS[key];
    };
    settings = missionSettingsInputSchema.parse({
      defaultAltitude: pick('defaultAltitude'),
      defaultSpeed: pick('defaultSpeed'),
      defaultLoiterTime: pick('defaultLoiterTime'),
      defaultWaitTime: pick('defaultWaitTime'),
      altitudeReference: 'relative',
    });
  }

  const fallbackName = upload.filename.replace(/\.[^.]+$/, '').trim() || 'Imported mission';
  const id = await createMissionDocument(user.id, {
    name: (upload.name ?? imported.name?.trim() ?? fallbackName).slice(0, 200) || fallbackName,
    description: imported.description?.slice(0, 2000) ?? null,
    home,
    settings,
    items,
    zones,
  });

  const full = await loadFullMission(id);
  return Response.json({ ok: true, mission: toMissionPlan(asDbMission(full!)), warnings }, { status: 201 });
}
