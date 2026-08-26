import { buildFlightDeckGraph, type FlightDeckStateType } from '@/lib/agents/graph';
import { FlightDeckRequestSchema, type AgentEvent, type FlightDeckResult } from '@/lib/agents/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

function sseFrame(event: AgentEvent): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

function resultFromState(state: FlightDeckStateType): FlightDeckResult {
  if (state.error) {
    return { status: 'error', draftMission: state.draftMission, auditReport: state.auditReport, vetoCount: state.vetoCount, error: state.error };
  }
  if (state.auditReport?.verdict === 'PASS') {
    return { status: 'approved_ready', draftMission: state.draftMission, auditReport: state.auditReport, vetoCount: state.vetoCount, error: null };
  }
  return {
    status: 'needs_human_input',
    draftMission: state.draftMission,
    auditReport: state.auditReport,
    vetoCount: state.vetoCount,
    error: null,
  };
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = FlightDeckRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
  }

  const graph = buildFlightDeckGraph();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let previousLogLength = 0;
      let lastState: FlightDeckStateType | null = null;

      try {
        const runStream = await graph.stream(
          {
            context: parsed.data,
            draftMission: null,
            auditReport: null,
            vetoCount: 0,
            agentLog: [],
            error: null,
          },
          { streamMode: 'values', recursionLimit: 20 }
        );

        for await (const state of runStream) {
          lastState = state as FlightDeckStateType;
          const newEvents = lastState.agentLog.slice(previousLogLength);
          previousLogLength = lastState.agentLog.length;
          for (const event of newEvents) {
            controller.enqueue(sseFrame(event));
          }
        }

        const result = lastState
          ? resultFromState(lastState)
          : { status: 'error' as const, draftMission: null, auditReport: null, vetoCount: 0, error: 'Graph produced no state' };

        controller.enqueue(
          sseFrame({
            id: `evt-${Date.now()}-done`,
            agent: 'SYSTEM',
            type: 'done',
            title: 'Flight Deck run complete',
            payload: result,
            timestamp: new Date().toISOString(),
          })
        );
      } catch (err) {
        controller.enqueue(
          sseFrame({
            id: `evt-${Date.now()}-error`,
            agent: 'SYSTEM',
            type: 'done',
            title: 'Flight Deck run failed',
            payload: {
              status: 'error',
              draftMission: null,
              auditReport: null,
              vetoCount: 0,
              error: err instanceof Error ? err.message : 'Unknown error',
            },
            timestamp: new Date().toISOString(),
          })
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
