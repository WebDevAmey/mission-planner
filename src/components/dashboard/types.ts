export interface MissionSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  status: 'draft' | 'ready' | 'archived';
  waypointCount: number;
  distanceM: number | null;
  durationS: number | null;
  errorCount: number | null;
  warningCount: number | null;
  bbox: [number, number, number, number] | null;
}

export function relativeTime(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}
