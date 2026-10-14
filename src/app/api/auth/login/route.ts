import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { loginSchema } from '@/lib/validation/auth';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { checkRateLimit, normalizeIdentifier, recordAttempt } from '@/lib/auth/rate-limit';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { getClientIp } from '@/lib/http/client-ip';

const GENERIC_ERROR = 'Incorrect email or password';

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

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { email, password } = parsed.data;
  const identifier = normalizeIdentifier(email);

  if (!(await checkRateLimit(identifier, 'login'))) {
    return Response.json(
      { ok: false, error: 'Too many attempts. Try again later.' },
      { status: 429 }
    );
  }

  const user = await db.orm.public.User.where((u) => u.email.eq(email)).first();

  // Always run a verify call, even with no user, so response timing doesn't
  // reveal whether the account exists (a constant-ish amount of argon2 work
  // either way, against a fixed dummy hash when there's no real one).
  const DUMMY_HASH =
    '$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHRzb21lc2FsdA$Q8CCzqz5Ts4pQWn5LjX9eLj1VqJ2d2kqgT0M6cHd4Ag';
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyPassword(password, DUMMY_HASH);

  if (!user || !valid) {
    await recordAttempt(identifier, 'login', false);
    return Response.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  const ip = getClientIp(request);
  const { token, expiresAt } = await createSession(user.id, {
    userAgent: request.headers.get('user-agent'),
    ipAddress: ip,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    expires: expiresAt,
  });

  await recordAttempt(identifier, 'login', true);

  return Response.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified !== null,
    },
  });
}
