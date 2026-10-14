import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/tokens';
import { createSession, deleteAllSessionsForUser, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { getClientIp } from '@/lib/http/client-ip';
import { toIsoString } from '@/lib/db/serialize';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { token, password } = parsed.data;
  const tokenHash = hashToken(token);

  const record = await db.orm.public.PasswordResetToken.where((t) => t.tokenHash.eq(tokenHash)).first();

  if (!record || record.usedAt !== null || new Date(record.expiresAt).getTime() <= Date.now()) {
    return Response.json(
      { ok: false, error: 'This reset link is invalid or has expired. Request a new one.' },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  await db.transaction(async (tx) => {
    await tx.orm.public.User.where({ id: record.userId }).update({ passwordHash });
    await tx.orm.public.PasswordResetToken.where({ id: record.id }).update({ usedAt: toIsoString(new Date()) });
  });

  // A compromised password shouldn't leave an attacker's existing session alive.
  await deleteAllSessionsForUser(record.userId);

  const ip = getClientIp(request);
  const { token: sessionToken, expiresAt } = await createSession(record.userId, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: ip,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });

  return Response.json({ ok: true });
}
