import { authorize, notFound } from '@/lib/http/api';
import { toMissionPlan } from '@/lib/missions/map';
import { asDbMission, duplicateMission, getOwnedFullMission, loadFullMission } from '@/lib/missions/repo';

/** POST /api/missions/:id/duplicate → 201 `{ ok, mission }` (copies settings, limits, items and zones). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const { id } = await params;
  const original = await getOwnedFullMission(id, user.id);
  if (!original) return notFound();

  const copyId = await duplicateMission(original, user.id);
  const full = await loadFullMission(copyId);
  return Response.json({ ok: true, mission: toMissionPlan(asDbMission(full!)) }, { status: 201 });
}
