import { cookies } from 'next/headers';
import { deleteSessionByToken, SESSION_COOKIE } from '@/lib/auth/session';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    await deleteSessionByToken(token);
  }

  cookieStore.delete(SESSION_COOKIE);
  return Response.json({ ok: true });
}
