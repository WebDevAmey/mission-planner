import type { AgentEvent, FlightDeckRequest } from '@/lib/agents/schemas';

export async function runFlightDeck(
  request: FlightDeckRequest,
  callbacks: { onEvent: (event: AgentEvent) => void; onDone: () => void; onError: (message: string) => void }
): Promise<void> {
  let response: Response;
  try {
    response = await fetch('/api/flight-deck', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    callbacks.onError('Could not reach the Flight Deck API. Is the dev server running?');
    return;
  }

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => '');
    callbacks.onError(`Flight Deck request failed (${response.status}): ${text.slice(0, 200)}`);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf('\n\n');
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf('\n\n');

        const line = frame.split('\n').find((l) => l.startsWith('data: '));
        if (!line) continue;
        try {
          const event = JSON.parse(line.slice('data: '.length)) as AgentEvent;
          callbacks.onEvent(event);
        } catch {
          // ignore malformed frame
        }
      }
    }
  } finally {
    callbacks.onDone();
  }
}
