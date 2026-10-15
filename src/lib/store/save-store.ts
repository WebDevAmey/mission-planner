import { create } from 'zustand';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error' | 'conflict';

interface SaveStoreState {
  status: SaveStatus;
  /** Human-readable reason for the last failure. */
  error: string | null;
  /** Server version the editor's document is based on (optimistic concurrency). */
  serverVersion: number | null;
  lastSavedAt: number | null;
  /** Save now (Retry button, in-app navigation). Resolves true when saved. */
  flush: () => Promise<boolean>;
  /** Resolve a 409: re-send local edits on top of the newer server version. */
  overwrite: () => Promise<boolean>;
  set: (patch: Partial<Omit<SaveStoreState, 'set'>>) => void;
}

export const useSaveStore = create<SaveStoreState>((set) => ({
  status: 'idle',
  error: null,
  serverVersion: null,
  lastSavedAt: null,
  flush: async () => true,
  overwrite: async () => true,
  set: (patch) => set(patch),
}));

export const hasUnsavedChanges = (status: SaveStatus) =>
  status === 'pending' || status === 'saving' || status === 'error' || status === 'conflict';
