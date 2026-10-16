import { cookies } from 'next/headers';
import { getCurrentSession } from '@/lib/auth/guard';
import { apiError, forbiddenOrigin, unauthorized, validationError } from '@/lib/http/api';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { revokeSessionsQuerySchema } from '@/lib/validation/account';
import {
  deleteAllSessionsForUser,
  deleteOtherSessions,
  deleteSessionById,
  listSessionsForUser,
  SESSION_COOKIE,
} from '@/lib/auth/session';
import { toIsoString } from '@/lib/db/serialize';
import { securityEvent } from '@/lib/http/security-log';

/** Hide the host part of an IP for display: 203.0.113.42 → 203.0.113.x */
function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  if (ip.includes('.')) return ip.split('.').slice(0, 3).concat('x').join('.');
  return ip.split(':').slice(0, 3).concat('…').join(':');
}

/**
 * GET /api/account/sessions → `{ ok, sessions: [{ id, current, createdAt, lastSeenAt, expiresAt, userAgent, ipAddress }] }`
 */
export async function GET() {
  const current = await getCurrentSession();
  if (!current) return unauthorized();
  const rows = await listSessionsForUser(current.user.id);
  return Response.json({
    ok: true,
    sessions: rows.map((s) => ({
      id: s.id,
      current: s.id === current.sessionId,
      createdAt: toIsoString(s.createdAt),
      lastSeenAt: s.lastSeenAt ? toIsoString(s.lastSeenAt) : null,
      expiresAt: toIsoString(s.expiresAt),
      userAgent: s.userAgent,
      ipAddress: maskIp(s.ipAddress),
    })),
  });
}

/**
 * DELETE /api/account/sessions?id=<sessionId>   revoke one session
 * DELETE /api/account/sessions?scope=others      sign out every other device (default)
 * DELETE /api/account/sessions?scope=all         sign out everywhere, including here
 * → `{ ok: true, revoked: number, signedOut: boolean }`
 */
export async function DELETE(request: Request) {
  if (!isSameOriginRequest(request)) return forbiddenOrigin();
  const current = await getCurrentSession();
  if (!current) return unauthorized();

  const parsed = revokeSessionsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { id, scope } = parsed.data;
  const userId = current.user.id;

  let revoked = 0;
  let signedOut = false;
  if (id) {
    if (!(await deleteSessionById(userId, id))) return apiError(404, 'NOT_FOUND', 'Session not found');
    revoked = 1;
    signedOut = id === current.sessionId;
  } else if (scope === 'all') {
    const count = (await listSessionsForUser(userId)).length;
    await deleteAllSessionsForUser(userId);
    revoked = count;
    signedOut = true;
  } else {
    revoked = await deleteOtherSessions(userId, current.sessionId);
  }

  securityEvent('sessions_revoked', { userId, scope: id ? 'one' : scope, revoked, signedOut });
  if (signedOut) (await cookies()).delete(SESSION_COOKIE);
  return Response.json({ ok: true, revoked, signedOut });
}
