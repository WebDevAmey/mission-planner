import { Annotation, StateGraph, START, END } from '@langchain/langgraph';
import { runAtlas } from '@/lib/agents/atlas-agent';
import { runSentinelAudit } from '@/lib/agents/sentinel-audit';
import type { AgentEvent, AuditReport, FlightDeckRequest, MissionDraft } from '@/lib/agents/schemas';

const MAX_VETOES = 3;

export const FlightDeckState = Annotation.Root({
  context: Annotation<FlightDeckRequest>(),
  draftMission: Annotation<MissionDraft | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  auditReport: Annotation<AuditReport | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
  vetoCount: Annotation<number>({
    reducer: (_prev, next) => next,
    default: () => 0,
  }),
  agentLog: Annotation<AgentEvent[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
  error: Annotation<string | null>({
    reducer: (_prev, next) => next,
    default: () => null,
  }),
});

export type FlightDeckStateType = typeof FlightDeckState.State;

async function atlasNode(state: FlightDeckStateType) {
  const { context } = state;
  const { draft, events, error } = await runAtlas({
    prompt: context.prompt,
    defaultAltitude: context.settings.defaultAltitude,
    defaultSpeed: context.settings.defaultSpeed,
    maxAltM: context.constraints.maxAltM,
    minAltM: context.constraints.minAltM,
    priorAudit: state.auditReport,
  });

  return {
    draftMission: draft,
    error,
    agentLog: events,
  };
}

async function sentinelNode(state: FlightDeckStateType) {
  const { context, draftMission } = state;
  if (!draftMission) {
    return { agentLog: [], auditReport: null };
  }

  const startEvent: AgentEvent = {
    id: `evt-${Date.now()}-sentinel-start`,
    agent: 'SENTINEL',
    type: 'thinking',
    title: 'Auditing mission draft…',
    timestamp: new Date().toISOString(),
  };

  const { report } = await runSentinelAudit(draftMission, {
    settings: context.settings,
    config: context.constraints,
    nfzs: context.nfzs,
    geofences: context.geofences,
    homePosition: context.homePosition,
  });

  const resultEvent: AgentEvent = {
    id: `evt-${Date.now()}-sentinel-result`,
    agent: 'SENTINEL',
    type: 'audit',
    title: report.verdict === 'PASS' ? 'SENTINEL: PASS' : 'SENTINEL: VETO',
    payload: report,
    timestamp: new Date().toISOString(),
  };

  const nextVetoCount = report.verdict === 'VETO' ? state.vetoCount + 1 : state.vetoCount;

  return {
    auditReport: report,
    vetoCount: nextVetoCount,
    agentLog: [startEvent, resultEvent],
  };
}

function routeAfterSentinel(state: FlightDeckStateType): 'atlas' | typeof END {
  if (state.error) return END;
  if (!state.auditReport) return END;
  if (state.auditReport.verdict === 'PASS') return END;
  if (state.vetoCount >= MAX_VETOES) return END;
  return 'atlas';
}

export function buildFlightDeckGraph() {
  const graph = new StateGraph(FlightDeckState)
    .addNode('atlas', atlasNode)
    .addNode('sentinel', sentinelNode)
    .addEdge(START, 'atlas')
    .addEdge('atlas', 'sentinel')
    .addConditionalEdges('sentinel', routeAfterSentinel, { atlas: 'atlas', [END]: END });

  return graph.compile();
}
