import { cookies } from 'next/headers';
import { checkPassword, createSessionToken, SESSION_COOKIE } from '@/lib/auth/session';

export async function POST(request: Request) {
  let password: unknown;
  try {
    ({ password } = await request.json());
  } catch {
    return Response.json({ ok: false, error: 'Invalid request body' }, { status: 400 });
  }

  if (typeof password !== 'string' || password.length === 0) {
    return Response.json({ ok: false, error: 'Password is required' }, { status: 400 });
  }

  let valid: boolean;
  try {
    valid = checkPassword(password);
  } catch (err) {
    return Response.json({ ok: false, error: err instanceof Error ? err.message : 'Server misconfigured' }, { status: 500 });
  }

  if (!valid) {
    return Response.json({ ok: false, error: 'Incorrect password' }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 60 * 60,
  });

  return Response.json({ ok: true });
}
