import { db } from '@/prisma/db';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/tokens';
import { deleteAllSessionsForUser } from '@/lib/auth/session';
import { startSession } from '@/lib/auth/guard';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { toIsoString } from '@/lib/db/serialize';
import { AUTH_MAX_BODY_BYTES, readJsonBody } from '@/lib/http/api';
import { securityEvent } from '@/lib/http/security-log';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  const read = await readJsonBody(request, { maxBytes: AUTH_MAX_BODY_BYTES });
  if (!read.ok) return read.response;
  const body = read.data;

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const invalid = () => {
    securityEvent('password_reset_rejected');
    return Response.json(
      { ok: false, error: 'This reset link is invalid or has expired. Request a new one.' },
      { status: 400 }
    );
  };

  const record = await db.orm.public.PasswordResetToken.where((t) => t.tokenHash.eq(tokenHash)).first();
  if (!record || record.usedAt !== null || new Date(record.expiresAt).getTime() <= Date.now()) return invalid();

  const passwordHash = await hashPassword(password);

  // Single use under concurrency: lock the token row and re-check it inside the
  // transaction, so two simultaneous requests can't both spend the same token.
  const consumed = await db.transaction(async (tx) => {
    const row = await tx.orm.public.PasswordResetToken.where({ id: record.id }).forNoKeyUpdate().first();
    if (!row || row.usedAt !== null) return false;
    const now = toIsoString(new Date());
    await tx.orm.public.User.where({ id: record.userId }).update({ passwordHash, updatedAt: now });
    await tx.orm.public.PasswordResetToken.where({ id: record.id }).update({ usedAt: now });
    await tx.orm.public.PasswordResetToken.where({ userId: record.userId })
      .where((t) => t.usedAt.isNull())
      .deleteAll();
    return true;
  });
  if (!consumed) return invalid();

  // A compromised password shouldn't leave an attacker's existing session alive.
  await deleteAllSessionsForUser(record.userId);

  await startSession(record.userId, request);
  securityEvent('password_reset_completed', { userId: record.userId });

  return Response.json({ ok: true });
}
