import { buildFlightDeckGraph, type FlightDeckStateType } from '@/lib/agents/graph';
import { FlightDeckRequestSchema, type AgentEvent, type FlightDeckResult } from '@/lib/agents/schemas';
import { apiError, authorize, readJsonBody, validationError } from '@/lib/http/api';
import { consumeQuota } from '@/lib/auth/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const encoder = new TextEncoder();

/** Per-user AI quota (S1; DECISIONS open question 3). */
const QUOTA = [
  { windowMs: 60 * 60 * 1000, max: 10 },
  { windowMs: 24 * 60 * 60 * 1000, max: 50 },
];
const MAX_BODY_BYTES = 256 * 1024;
const RUN_TIMEOUT_MS = 120_000;

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
  const user = await authorize(request);
  if (user instanceof Response) return user;

  const body = await readJsonBody(request, { maxBytes: MAX_BODY_BYTES });
  if (!body.ok) return body.response;
  const parsed = FlightDeckRequestSchema.safeParse(body.data);
  if (!parsed.success) return validationError(parsed.error);

  const quota = await consumeQuota(`user:${user.id}`, 'flight_deck', QUOTA);
  if (!quota.allowed) {
    return apiError(
      429,
      'RATE_LIMITED',
      'Flight Deck run limit reached. Try again later.',
      { retryAfterS: quota.retryAfterS },
      { headers: { 'Retry-After': String(quota.retryAfterS) } }
    );
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
          { streamMode: 'values', recursionLimit: 20, signal: AbortSignal.timeout(RUN_TIMEOUT_MS) }
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
