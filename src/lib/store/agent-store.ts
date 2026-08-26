import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AgentEvent, FlightDeckResult } from '@/lib/agents/schemas';

export type FlightDeckStatus = 'idle' | 'running' | 'awaiting_approval' | 'needs_human_input' | 'error';

/** One completed Flight Deck run, kept for the on-device audit trail — who asked ATLAS
 * for what, and why SENTINEL passed or vetoed it. This is the record a commercial
 * operator would need to show for a given flight's planning history. */
export interface FlightDeckRunRecord {
  id: string;
  prompt: string;
  timestamp: string;
  status: FlightDeckResult['status'];
  vetoCount: number;
  riskScore: number | null;
  blockerCount: number;
  waypointCount: number;
}

const MAX_HISTORY = 50;

interface AgentStoreState {
  status: FlightDeckStatus;
  events: AgentEvent[];
  result: FlightDeckResult | null;
  consoleOpen: boolean;
  history: FlightDeckRunRecord[];
  currentPrompt: string;
  startRun: (prompt: string) => void;
  addEvent: (event: AgentEvent) => void;
  finishRun: (result: FlightDeckResult) => void;
  fail: (message: string) => void;
  clearRun: () => void;
  clearHistory: () => void;
  toggleConsole: () => void;
  setConsoleOpen: (open: boolean) => void;
}

export const useAgentStore = create<AgentStoreState>()(
  persist(
    (set, get) => ({
      status: 'idle',
      events: [],
      result: null,
      consoleOpen: false,
      history: [],
      currentPrompt: '',

      startRun: (prompt) =>
        set({ status: 'running', events: [], result: null, consoleOpen: true, currentPrompt: prompt }),

      addEvent: (event) => set((s) => ({ events: [...s.events, event] })),

      finishRun: (result) => {
        const record: FlightDeckRunRecord = {
          id: `run-${Date.now()}`,
          prompt: get().currentPrompt,
          timestamp: new Date().toISOString(),
          status: result.status,
          vetoCount: result.vetoCount,
          riskScore: result.auditReport?.riskScore ?? null,
          blockerCount: result.auditReport?.findings.filter((f) => f.severity === 'blocker').length ?? 0,
          waypointCount: result.draftMission?.waypoints.length ?? 0,
        };
        set((s) => ({
          result,
          status:
            result.status === 'approved_ready'
              ? 'awaiting_approval'
              : result.status === 'needs_human_input'
              ? 'needs_human_input'
              : 'error',
          history: [record, ...s.history].slice(0, MAX_HISTORY),
        }));
      },

      fail: (message) =>
        set((s) => ({
          status: 'error',
          result: { status: 'error', draftMission: null, auditReport: null, vetoCount: 0, error: message },
          events: [
            ...s.events,
            {
              id: `evt-${Date.now()}-client-error`,
              agent: 'SYSTEM',
              type: 'error',
              title: 'Connection error',
              detail: message,
              timestamp: new Date().toISOString(),
            },
          ],
        })),

      clearRun: () => set({ status: 'idle', events: [], result: null }),
      clearHistory: () => set({ history: [] }),

      toggleConsole: () => set((s) => ({ consoleOpen: !s.consoleOpen })),
      setConsoleOpen: (open) => set({ consoleOpen: open }),
    }),
    {
      name: 'mps-flight-deck-history',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ history: s.history }),
    }
  )
);
