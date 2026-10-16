import { cookies } from 'next/headers';
import { db } from '@/prisma/db';
import { signupSchema } from '@/lib/validation/auth';
import { hashPassword } from '@/lib/auth/password';
import { createSession, SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/auth/session';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { checkRateLimit, normalizeIdentifier, recordAttempt } from '@/lib/auth/rate-limit';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { getClientIp } from '@/lib/http/client-ip';
import { sendVerificationEmail } from '@/lib/email/send';
import { toIsoString } from '@/lib/db/serialize';
import { AUTH_MAX_BODY_BYTES, readJsonBody } from '@/lib/http/api';
import { appOrigin } from '@/lib/http/app-origin';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  const read = await readJsonBody(request, { maxBytes: AUTH_MAX_BODY_BYTES });
  if (!read.ok) return read.response;
  const body = read.data;

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { email, password, name } = parsed.data;

  // S6: keyed on both the client IP (when known) and the email, so neither a
  // shared NAT nor rotating IPs against one address gets unlimited attempts.
  const ip = getClientIp(request);
  const emailKey = `email:${normalizeIdentifier(email)}`;
  const rateLimitKey = ip ? `ip:${normalizeIdentifier(ip)}` : emailKey;
  const keys = rateLimitKey === emailKey ? [emailKey] : [rateLimitKey, emailKey];
  const allowed = await Promise.all(keys.map((k) => checkRateLimit(k, 'signup')));
  if (allowed.includes(false)) {
    return Response.json(
      { ok: false, error: 'Too many signup attempts. Try again later.' },
      { status: 429 }
    );
  }

  const existing = await db.orm.public.User.where((u) => u.email.eq(email)).first();
  if (existing) {
    await Promise.all(keys.map((k) => recordAttempt(k, 'signup', false)));
    return Response.json(
      { ok: false, error: 'An account with this email already exists' },
      { status: 409 }
    );
  }

  const passwordHash = await hashPassword(password);
  const user = await db.orm.public.User.create({
    email,
    passwordHash,
    name: name || null,
  });

  const verificationToken = generateToken();
  await db.orm.public.EmailVerificationToken.create({
    tokenHash: hashToken(verificationToken),
    userId: user.id,
    expiresAt: toIsoString(new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)),
  });

  const origin = appOrigin(request);
  const verifyUrl = `${origin}/verify-email?token=${verificationToken}`;

  const { delivered } = await sendVerificationEmail(user.email, verifyUrl);

  const { token: sessionToken, expiresAt } = await createSession(user.id, {
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

  await Promise.all(keys.map((k) => recordAttempt(k, 'signup', true)));

  return Response.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, emailVerified: false },
    emailDelivered: delivered,
    // Dev-only convenience so the flow is testable without RESEND_API_KEY configured.
    // Never present outside development — see sendVerificationEmail's delivered flag.
    devVerifyUrl: !delivered && process.env.NODE_ENV !== 'production' ? verifyUrl : undefined,
  });
}
