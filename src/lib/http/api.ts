import type { ZodError } from 'zod';
import { getCurrentUser } from '@/lib/auth/guard';
import type { SessionUser } from '@/lib/auth/session';
import { isSameOriginRequest } from '@/lib/http/same-origin';

/**
 * Shared plumbing for route handlers so every endpoint answers errors in one
 * shape — `{ ok: false, error, code, issues? }` (TECHNICAL_SPEC §5.2) — and no
 * handler can forget the origin check or the in-handler session check.
 */

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN_ORIGIN'
  | 'NOT_FOUND'
  | 'INVALID_BODY'
  | 'VALIDATION_FAILED'
  | 'VERSION_CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'UNPROCESSABLE'
  | 'INVALID_CREDENTIALS'
  | 'UPSTREAM_FAILED'
  | 'INTERNAL';

export interface ApiIssue {
  path: string;
  message: string;
}

export function apiError(
  status: number,
  code: ApiErrorCode,
  error: string,
  extra?: Record<string, unknown>,
  init?: ResponseInit
): Response {
  return Response.json({ ok: false, error, code, ...extra }, { ...init, status });
}

export function zodIssues(err: ZodError): ApiIssue[] {
  return err.issues.slice(0, 20).map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
  }));
}

/** 400 carrying the first issue (with its path) as the message plus the full list. */
export function validationError(err: ZodError): Response {
  const issues = zodIssues(err);
  const first = issues[0];
  const error = first ? (first.path ? `${first.path}: ${first.message}` : first.message) : 'Invalid input';
  return apiError(400, 'VALIDATION_FAILED', error, { issues });
}

export const unauthorized = () => apiError(401, 'UNAUTHORIZED', 'Unauthorized');
export const forbiddenOrigin = () => apiError(403, 'FORBIDDEN_ORIGIN', 'Invalid request origin');
export const notFound = (what = 'Mission') => apiError(404, 'NOT_FOUND', `${what} not found`);

/**
 * Authenticates a route-handler request. Mutations (anything but GET/HEAD)
 * also get the same-origin CSRF check. Returns the user, or a ready Response
 * to send back.
 */
export async function authorize(request: Request): Promise<SessionUser | Response> {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD' && !isSameOriginRequest(request)) {
    return forbiddenOrigin();
  }
  const user = await getCurrentUser();
  return user ?? unauthorized();
}

export const DEFAULT_MAX_BODY_BYTES = 1024 * 1024;

/**
 * Reads a JSON body with a hard size cap (checked against Content-Length up
 * front and the actual byte count after reading). `allowEmpty` treats an empty
 * body as `{}`.
 */
export async function readJsonBody(
  request: Request,
  opts: { maxBytes?: number; allowEmpty?: boolean } = {}
): Promise<{ ok: true; data: unknown } | { ok: false; response: Response }> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BODY_BYTES;
  const tooLarge = () => ({
    ok: false as const,
    response: apiError(413, 'PAYLOAD_TOO_LARGE', `Request body exceeds ${Math.round(maxBytes / 1024)} KB`),
  });

  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: apiError(400, 'INVALID_BODY', 'Invalid request body') };
  }
  if (Buffer.byteLength(text, 'utf8') > maxBytes) return tooLarge();
  if (!text.trim()) {
    return opts.allowEmpty
      ? { ok: true, data: {} }
      : { ok: false, response: apiError(400, 'INVALID_BODY', 'Request body is required') };
  }
  try {
    return { ok: true, data: JSON.parse(text) };
  } catch {
    return { ok: false, response: apiError(400, 'INVALID_BODY', 'Request body is not valid JSON') };
  }
}

/** `[^a-z0-9-_]` → `-`, collapsed, at most 80 chars (TECHNICAL_SPEC §8). */
export function slugify(value: string, fallback = 'mission'): string {
  const slug = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || fallback;
}
