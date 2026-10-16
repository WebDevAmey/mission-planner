import { db } from '@/prisma/db';
import { getCurrentUser } from '@/lib/auth/guard';
import { generateToken, hashToken } from '@/lib/auth/tokens';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { sendVerificationEmail } from '@/lib/email/send';
import { toIsoString } from '@/lib/db/serialize';
import { checkRateLimit, recordAttempt } from '@/lib/auth/rate-limit';
import { appOrigin } from '@/lib/http/app-origin';

const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  if (user.emailVerified) {
    return Response.json({ ok: true, alreadyVerified: true });
  }

  const rateKey = `user:${user.id}`;
  if (!(await checkRateLimit(rateKey, 'resend_verification'))) {
    return Response.json(
      { ok: false, error: 'Too many verification emails. Try again later.', code: 'RATE_LIMITED' },
      { status: 429 }
    );
  }
  await recordAttempt(rateKey, 'resend_verification', true);

  await db.orm.public.EmailVerificationToken.where({ userId: user.id }).deleteAll();

  const verificationToken = generateToken();
  await db.orm.public.EmailVerificationToken.create({
    tokenHash: hashToken(verificationToken),
    userId: user.id,
    expiresAt: toIsoString(new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS)),
  });

  const origin = appOrigin(request);
  const verifyUrl = `${origin}/verify-email?token=${verificationToken}`;
  const { delivered } = await sendVerificationEmail(user.email, verifyUrl);

  return Response.json({
    ok: true,
    emailDelivered: delivered,
    devVerifyUrl: !delivered && process.env.NODE_ENV !== 'production' ? verifyUrl : undefined,
  });
}
