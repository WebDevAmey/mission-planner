import { db } from '@/prisma/db';
import { verifyEmailSchema } from '@/lib/validation/auth';
import { hashToken } from '@/lib/auth/tokens';
import { isSameOriginRequest } from '@/lib/http/same-origin';
import { toIsoString } from '@/lib/db/serialize';
import { AUTH_MAX_BODY_BYTES, readJsonBody } from '@/lib/http/api';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin' }, { status: 403 });
  }

  const read = await readJsonBody(request, { maxBytes: AUTH_MAX_BODY_BYTES });
  if (!read.ok) return read.response;
  const body = read.data;

  const parsed = verifyEmailSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Verification link is invalid' }, { status: 400 });
  }

  const tokenHash = hashToken(parsed.data.token);
  const record = await db.orm.public.EmailVerificationToken.where((t) => t.tokenHash.eq(tokenHash)).first();

  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) {
    return Response.json(
      { ok: false, error: 'This verification link is invalid or has expired' },
      { status: 400 }
    );
  }

  await db.orm.public.User.where({ id: record.userId }).update({ emailVerified: toIsoString(new Date()) });
  await db.orm.public.EmailVerificationToken.where({ userId: record.userId }).deleteAll();

  return Response.json({ ok: true });
}
