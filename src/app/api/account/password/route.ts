import { db } from '@/prisma/db';
import { apiError, authorize, readJsonBody, validationError } from '@/lib/http/api';
import { changePasswordSchema } from '@/lib/validation/account';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { checkRateLimit, recordAttempt } from '@/lib/auth/rate-limit';
import { deleteAllSessionsForUser } from '@/lib/auth/session';
import { startSession } from '@/lib/auth/guard';
import { toIsoString } from '@/lib/db/serialize';
import { securityEvent } from '@/lib/http/security-log';

/**
 * POST /api/account/password `{ currentPassword, newPassword }` → `{ ok: true }`.
 * Re-authenticates with the current password, revokes every session (S8) and
 * issues a fresh one for this device.
 */
export async function POST(request: Request) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, { maxBytes: 4 * 1024 });
  if (!body.ok) return body.response;
  const parsed = changePasswordSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const rateKey = `user:${user.id}`;
  if (!(await checkRateLimit(rateKey, 'password_change'))) {
    return apiError(429, 'RATE_LIMITED', 'Too many attempts. Try again later.');
  }

  const row = await db.orm.public.User.where({ id: user.id }).first();
  if (!row || !(await verifyPassword(parsed.data.currentPassword, row.passwordHash))) {
    await recordAttempt(rateKey, 'password_change', false);
    securityEvent('password_change_failed', { userId: user.id });
    return apiError(403, 'INVALID_CREDENTIALS', 'Current password is incorrect', {
      issues: [{ path: 'currentPassword', message: 'Current password is incorrect' }],
    });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.orm.public.User.where({ id: user.id }).update({ passwordHash, updatedAt: toIsoString(new Date()) });
  await recordAttempt(rateKey, 'password_change', true);
  // A reset link requested before the change must not be able to undo it.
  await db.orm.public.PasswordResetToken.where({ userId: user.id }).deleteAll();

  await deleteAllSessionsForUser(user.id);
  await startSession(user.id, request);
  securityEvent('password_changed', { userId: user.id });

  return Response.json({ ok: true });
}
