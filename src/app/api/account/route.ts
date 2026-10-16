import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { apiError, authorize, readJsonBody, validationError } from '@/lib/http/api';
import { deleteAccountSchema, updateAccountSchema } from '@/lib/validation/account';
import { verifyPassword } from '@/lib/auth/password';
import { checkRateLimit, recordAttempt } from '@/lib/auth/rate-limit';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { toIsoString } from '@/lib/db/serialize';
import { securityEvent } from '@/lib/http/security-log';

async function loadProfile(userId: string) {
  const u = await db.orm.public.User.where({ id: userId }).first();
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: u.emailVerified !== null,
    createdAt: toIsoString(u.createdAt),
  };
}

/** GET /api/account → `{ ok, user: { id, email, name, emailVerified, createdAt } }` */
export async function GET(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;
  return Response.json({ ok: true, user: await loadProfile(user.id) });
}

/** PATCH /api/account `{ name: string | null }` → `{ ok, user }` */
export async function PATCH(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, { maxBytes: 4 * 1024 });
  if (!body.ok) return body.response;
  const parsed = updateAccountSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  await db.orm.public.User.where({ id: user.id }).update({
    name: parsed.data.name || null,
    updatedAt: toIsoString(new Date()),
  });
  return Response.json({ ok: true, user: await loadProfile(user.id) });
}

/**
 * DELETE /api/account `{ password }` → `{ ok: true }`. Irreversible: cascades to
 * sessions, tokens, missions, settings, waypoints and zones; clears the cookie.
 */
export async function DELETE(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, { maxBytes: 4 * 1024 });
  if (!body.ok) return body.response;
  const parsed = deleteAccountSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const rateKey = `user:${user.id}`;
  if (!(await checkRateLimit(rateKey, 'account_delete'))) {
    return apiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
  }

  const row = await db.orm.public.User.where({ id: user.id }).first();
  if (!row || !(await verifyPassword(parsed.data.password, row.passwordHash))) {
    await recordAttempt(rateKey, 'account_delete', false);
    securityEvent('account_delete_failed', { userId: user.id });
    return apiError(403, 'INVALID_CREDENTIALS', 'Password is incorrect');
  }

  await db.orm.public.User.where({ id: user.id }).delete();
  securityEvent('account_deleted', { userId: user.id });
  await db.orm.public.AuthAttempt.where((a) => a.identifier.eq(rateKey)).deleteAll();

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
