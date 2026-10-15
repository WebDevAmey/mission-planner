import { redirect } from 'next/navigation';

/** Legacy editor URL. The editor now lives at /missions/[id]. */
export default async function MissionPlannerRedirect({
  searchParams,
}: {
  searchParams: Promise<{ mission?: string | string[] }>;
}) {
  const { mission } = await searchParams;
  const id = Array.isArray(mission) ? mission[0] : mission;
  redirect(id ? `/missions/${encodeURIComponent(id)}` : '/dashboard');
}
