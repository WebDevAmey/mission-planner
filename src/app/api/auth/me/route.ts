import { getCurrentUser } from '@/lib/auth/guard';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ ok: false, user: null }, { status: 401 });
  }
  return Response.json({ ok: true, user });
}
