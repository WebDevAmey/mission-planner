import { ChatAnthropic } from '@langchain/anthropic';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import { ATLAS_SYSTEM_PROMPT, buildAtlasUserMessage } from '@/lib/agents/prompts';
import { atlasTools } from '@/lib/agents/tools';
import { MissionDraftSchema, type AgentEvent, type AuditReport, type MissionDraft } from '@/lib/agents/schemas';

const MAX_TOOL_ROUNDS = 4;
const MAX_PARSE_RETRIES = 1;
const MODEL_TIMEOUT_MS = 30_000;
const TOOL_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)),
  ]);
}

async function invokeWithRetry(
  model: { invoke: (messages: BaseMessage[]) => Promise<AIMessage> },
  messages: BaseMessage[]
): Promise<AIMessage> {
  try {
    return await withTimeout(model.invoke(messages), MODEL_TIMEOUT_MS, 'Model call');
  } catch {
    return await withTimeout(model.invoke(messages), MODEL_TIMEOUT_MS, 'Model call (retry)');
  }
}

let counter = 0;
function eventId(): string {
  return `evt-${Date.now()}-${++counter}`;
}

function now(): string {
  return new Date().toISOString();
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  return JSON.parse(candidate);
}

const toolsByName = new Map<string, (args: unknown) => Promise<unknown>>(
  atlasTools.map((t) => {
    const anyTool = t as { invoke: (args: unknown) => Promise<unknown> };
    return [t.name, (args: unknown) => anyTool.invoke(args)] as const;
  })
);

export async function runAtlas(params: {
  prompt: string;
  defaultAltitude: number;
  defaultSpeed: number;
  maxAltM: number;
  minAltM: number;
  priorAudit?: AuditReport | null;
}): Promise<{ draft: MissionDraft | null; events: AgentEvent[]; error: string | null }> {
  const events: AgentEvent[] = [];
  const push = (e: AgentEvent) => events.push(e);

  if (!process.env.ANTHROPIC_API_KEY) {
    const msg = 'ANTHROPIC_API_KEY is not set on the server — add it to .env.local and restart the dev server.';
    push({ id: eventId(), agent: 'ATLAS', type: 'error', title: 'Missing API key', detail: msg, timestamp: now() });
    return { draft: null, events, error: msg };
  }

  const model = new ChatAnthropic({
    model: 'claude-sonnet-4-5',
    temperature: 0.3,
    maxTokens: 4096,
  }).bindTools(atlasTools);

  const messages: BaseMessage[] = [
    new SystemMessage(ATLAS_SYSTEM_PROMPT),
    new HumanMessage(
      buildAtlasUserMessage({
        prompt: params.prompt,
        defaultAltitude: params.defaultAltitude,
        defaultSpeed: params.defaultSpeed,
        maxAltM: params.maxAltM,
        minAltM: params.minAltM,
        priorAudit: params.priorAudit,
      })
    ),
  ];

  push({
    id: eventId(),
    agent: 'ATLAS',
    type: 'thinking',
    title: params.priorAudit ? 'Revising mission after SENTINEL veto…' : 'Drafting mission from request…',
    timestamp: now(),
  });

  let response = await invokeWithRetry(model, messages);
  let rounds = 0;

  while (response.tool_calls && response.tool_calls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
    rounds++;
    messages.push(response as AIMessage);

    for (const call of response.tool_calls) {
      push({
        id: eventId(),
        agent: 'ATLAS',
        type: 'tool_call',
        title: `Calling ${call.name}`,
        detail: JSON.stringify(call.args),
        timestamp: now(),
      });
    }

    // Tool calls within a round are independent — run them concurrently instead of
    // serially to cut round-trip latency (geocode + terrain lookups often co-occur).
    const results = await Promise.all(
      response.tool_calls.map(async (call) => {
        const toolFn = toolsByName.get(call.name);
        try {
          return toolFn
            ? await withTimeout(toolFn(call.args), TOOL_TIMEOUT_MS, `Tool ${call.name}`)
            : { ok: false, error: 'UNKNOWN_TOOL' };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err.message : 'TOOL_ERROR' };
        }
      })
    );

    response.tool_calls.forEach((call, i) => {
      const result = results[i];
      push({
        id: eventId(),
        agent: 'ATLAS',
        type: 'tool_result',
        title: `${call.name} result`,
        detail: JSON.stringify(result),
        timestamp: now(),
      });
      messages.push(
        new ToolMessage({
          tool_call_id: call.id ?? call.name,
          content: JSON.stringify(result),
        })
      );
    });

    response = await invokeWithRetry(model, messages);
  }

  const textOf = (res: typeof response): string =>
    typeof res.content === 'string'
      ? res.content
      : res.content.map((c) => ('text' in c ? c.text : '')).join('');

  for (let attempt = 0; attempt <= MAX_PARSE_RETRIES; attempt++) {
    const rawText = textOf(response);
    try {
      const parsed = extractJson(rawText);
      const draft = MissionDraftSchema.parse(parsed);
      if (draft.error) {
        push({ id: eventId(), agent: 'ATLAS', type: 'error', title: 'ATLAS could not plan this mission', detail: draft.error, timestamp: now() });
        return { draft: null, events, error: draft.error };
      }
      push({ id: eventId(), agent: 'ATLAS', type: 'draft', title: 'Mission draft ready', payload: draft, timestamp: now() });
      return { draft, events, error: null };
    } catch (err) {
      if (attempt === MAX_PARSE_RETRIES) {
        const msg = `ATLAS returned invalid output: ${err instanceof Error ? err.message : 'parse error'}`;
        push({ id: eventId(), agent: 'ATLAS', type: 'error', title: 'Schema validation failed', detail: msg, timestamp: now() });
        return { draft: null, events, error: msg };
      }
      messages.push(new AIMessage(rawText));
      messages.push(
        new HumanMessage(
          `Your last response was not valid JSON matching the MissionDraft schema. Error: ${
            err instanceof Error ? err.message : String(err)
          }. Respond again with ONLY the corrected JSON object, no markdown fences.`
        )
      );
      response = await invokeWithRetry(model, messages);
    }
  }

  return { draft: null, events, error: 'Unreachable' };
}
