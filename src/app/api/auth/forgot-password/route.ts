import { db } from '@/prisma/db';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { checkRateLimit, normalizeIdentifier, recordAttempt } from '@/lib/auth/rate-limit';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { sendPasswordResetEmail } from '@/lib/email/send';
import { toIsoString } from '@/lib/db/serialize';
import { AUTH_MAX_BODY_BYTES, readJsonBody } from '@/lib/http/api';
import { appOrigin } from '@/lib/http/app-origin';
import { securityEvent, subjectRef } from '@/lib/http/security-log';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Always the same message, whether or not the email has an account — the
// account-enumeration defense the brief asks for. Only when email delivery is
// not configured in a non-production environment do we also hand back a
// working link, so the flow stays testable without a real inbox.
export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  const read = await readJsonBody(request, { maxBytes: AUTH_MAX_BODY_BYTES });
  if (!read.ok) return read.response;
  const body = read.data;

  const parsed = forgotPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 }
    );
  }
  const { email } = parsed.data;
  const identifier = normalizeIdentifier(email);

  if (!(await checkRateLimit(identifier, 'forgot_password'))) {
    securityEvent('password_reset_throttled', { subject: subjectRef(identifier) });
    return Response.json(
      { ok: false, error: 'Too many requests. Try again later.' },
      { status: 429 }
    );
  }

  const user = await db.orm.public.User.where((u) => u.email.eq(email)).first();
  await recordAttempt(identifier, 'forgot_password', true);
  securityEvent('password_reset_requested', { subject: subjectRef(identifier), userId: user?.id ?? null });

  let devResetUrl: string | undefined;

  if (user) {
    await db.orm.public.PasswordResetToken.where({ userId: user.id }).where((t) => t.usedAt.isNull()).deleteAll();

    const resetToken = generateToken();
    await db.orm.public.PasswordResetToken.create({
      tokenHash: hashToken(resetToken),
      userId: user.id,
      expiresAt: toIsoString(new Date(Date.now() + RESET_TOKEN_TTL_MS)),
    });

      const origin = appOrigin(request);
    const resetUrl = `${origin}/reset-password?token=${resetToken}`;
    const { delivered } = await sendPasswordResetEmail(user.email, resetUrl);

    if (!delivered && process.env.NODE_ENV !== 'production') {
      devResetUrl = resetUrl;
    }
  }

  return Response.json({
    ok: true,
    message: 'If an account exists for that email, a reset link has been sent.',
    devResetUrl,
  });
}
