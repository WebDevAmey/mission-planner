import { authorize, notFound } from '@/lib/http/api';
import { toMissionPlan } from '@/lib/missions/map';
import { asDbMission, duplicateMissionDocument, getOwnedFullMission } from '@/lib/missions/repo';

/** POST /api/missions/:id/duplicate → 201 `{ ok, mission }` (copies settings, limits, items and zones). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const { id } = await params;
  const original = await getOwnedFullMission(id, user.id);
  if (!original) return notFound();

  const copy = await duplicateMissionDocument(original, user.id);
  return Response.json({ ok: true, mission: toMissionPlan(asDbMission(copy)) }, { status: 201 });
}
