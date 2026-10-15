import { create } from 'zustand';
import type { ClearanceSample } from '@/lib/domain/metrics';

/** Latest terrain clearance profile for the open mission (filled by the terrain
 * panel once elevations are fetched) so the Checks tab can include AGL issues. */
interface TerrainStoreState {
  missionKey: string | null;
  samples: ClearanceSample[] | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  set: (patch: Partial<Omit<TerrainStoreState, 'set'>>) => void;
}

export const useTerrainStore = create<TerrainStoreState>((set) => ({
  missionKey: null,
  samples: null,
  status: 'idle',
  set: (patch) => set(patch),
}));
