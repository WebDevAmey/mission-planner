import { cookies } from 'next/headers';
import { deleteSessionByToken, SESSION_COOKIE } from '@/lib/auth/session';
import { isSameOriginRequest } from '@/lib/http/same-origin';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ ok: false, error: 'Invalid request origin', code: 'FORBIDDEN_ORIGIN' }, { status: 403 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await deleteSessionByToken(token);
  }

  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
