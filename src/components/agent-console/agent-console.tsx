'use client';

import { useEffect, useRef, useState } from 'react';
import { RiCloseLine, RiDownloadLine } from '@remixicon/react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { useAgentStore } from '@/lib/store/agent-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { buildMissionItemsFromDraft } from '@/lib/agents/sentinel-audit';
import type { AgentEvent } from '@/lib/agents/schemas';
import { cx } from '@/utils/cx';
import { INK_BUTTON, LABEL_MONO, SEGMENT_LIST, SEGMENT_TAB, TONE_DOT, TONE_TEXT, type Tone } from '@/components/editor/editor-styles';
import { QuietButton } from '@/components/editor/quiet-button';
import { MissionPromptBar } from './mission-prompt-bar';

/** User-facing names for the run's stages (D-11). Code identifiers and event names are unchanged. */
const AGENT_LABEL: Record<AgentEvent['agent'], string> = {
  ATLAS: 'Assistant',
  SENTINEL: 'Pre-flight checks',
  SYSTEM: 'System',
};
const AGENT_TONE: Record<AgentEvent['agent'], Tone> = { ATLAS: 'info', SENTINEL: 'warn', SYSTEM: 'muted' };

/** Server event titles still carry the internal stage names; translate them for display. */
export function displayTitle(title: string): string {
  return title
    .replace(/SENTINEL:\s*PASS/g, 'Pre-flight checks passed')
    .replace(/SENTINEL:\s*VETO/g, 'Pre-flight checks blocked the draft')
    .replace(/after SENTINEL veto/g, 'after failed checks')
    .replace(/^ATLAS could not/g, 'The assistant could not')
    .replace(/\bSENTINEL\b/g, 'pre-flight checks')
    .replace(/\bATLAS\b/g, 'the assistant');
}

function EventRow({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const hasDetail = event.type === 'tool_call' || event.type === 'tool_result';
  const isVeto = event.type === 'audit' && event.payload.verdict === 'VETO';
  const tone: Tone =
    event.type === 'error' ? 'danger' : event.type === 'audit' ? (isVeto ? 'danger' : 'ok') : AGENT_TONE[event.agent];

  return (
    <li className="border-b border-separator-border px-4 py-2.5 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <span aria-hidden className={cx('mt-[7px] size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={LABEL_MONO}>{AGENT_LABEL[event.agent]}</span>
          <span className="text-[14px] text-text-primary">{displayTitle(event.title)}</span>
        </div>
        {hasDetail && (
          <QuietButton size="xs" onPress={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
          </QuietButton>
        )}
      </div>
      {open && hasDetail && (
        <pre className="ml-4 mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-fd-control bg-background-secondary-default p-2 font-mono text-[12px] text-text-secondary">
          {event.detail}
        </pre>
      )}
      {event.type === 'audit' && (
        <div className="ml-4 mt-1.5 flex flex-col gap-1">
          <span className="text-[12px] tabular-nums text-text-tertiary">Risk score {event.payload.riskScore.toFixed(0)}/100</span>
          {event.payload.findings.map((f, i) => (
            <span
              key={i}
              className={cx('text-[13px]', f.severity === 'blocker' ? TONE_TEXT.danger : f.severity === 'warning' ? TONE_TEXT.warn : 'text-text-secondary')}
            >
              {f.message}
            </span>
          ))}
        </div>
      )}
      {event.type === 'error' && <p className={cx('ml-4 mt-1 text-[13px]', TONE_TEXT.danger)}>{event.detail}</p>}
    </li>
  );
}

function ApprovalCard() {
  const { result, clearRun, setConsoleOpen } = useAgentStore();
  const mission = useMissionStore((s) => s.mission);
  const replaceItems = useMissionStore((s) => s.replaceItems);
  const addToast = useUIStore((s) => s.addToast);

  if (!result || !result.draftMission) return null;
  const isVeto = result.status === 'needs_human_input';

  const approve = () => {
    if (!mission || !result.draftMission) return;
    replaceItems(buildMissionItemsFromDraft(result.draftMission, mission.settings), 'Load assistant draft');
    addToast('Draft loaded into the mission', 'success', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
    clearRun();
  };

  return (
    <div className="mx-4 my-3 flex flex-col gap-3 rounded-fd-control border border-separator-border bg-background-secondary-default p-3">
      <p className="flex items-center gap-2 text-[14px] font-medium text-text-primary">
        <span aria-hidden className={cx('size-2 rounded-full', isVeto ? TONE_DOT.danger : TONE_DOT.ok)} />
        {isVeto ? `Not cleared after ${result.vetoCount} attempts` : 'Pre-flight checks passed'}
      </p>
      <p className="text-[13px] text-text-secondary">
        <span className="tabular-nums">{result.draftMission.waypoints.length}</span> waypoints proposed.
        {isVeto ? ' Review the blockers above, adjust the description and try again.' : ' Loading replaces the current items as one undo step.'}
      </p>
      <div className="flex justify-end gap-2">
        <QuietButton
          onPress={() => {
            clearRun();
            setConsoleOpen(false);
          }}
        >
          Discard
        </QuietButton>
        {!isVeto && (
          <Button size="small" variant="secondary" onClick={approve} className={INK_BUTTON}>
            Load into mission
          </Button>
        )}
      </div>
    </div>
  );
}

function HistoryPanel() {
  const { history, clearHistory } = useAgentStore();

  const exportLog = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flight-deck-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center gap-1 px-4">
        <span className="flex-1 text-[13px] text-text-secondary">
          <span className="tabular-nums">{history.length}</span> run{history.length === 1 ? '' : 's'} on this device
        </span>
        {history.length > 0 && (
          <>
            <QuietButton size="xs" icon={RiDownloadLine} onPress={exportLog}>
              Export
            </QuietButton>
            <QuietButton size="xs" onPress={clearHistory}>
              Clear
            </QuietButton>
          </>
        )}
      </div>
      {history.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-text-secondary">Completed drafts are listed here with their check results.</p>
      ) : (
        <ul className="border-t border-separator-border">
          {history.map((run) => (
            <li key={run.id} className="flex flex-col gap-0.5 border-b border-separator-border px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span aria-hidden className={cx('size-1.5 rounded-full', run.status === 'approved_ready' ? TONE_DOT.ok : TONE_DOT.danger)} />
                <span className="text-[12px] font-medium text-text-primary">
                  {run.status === 'approved_ready' ? 'Passed' : run.status === 'needs_human_input' ? 'Blocked' : 'Error'}
                </span>
                <span className="flex-1 text-end text-[12px] tabular-nums text-text-tertiary">{new Date(run.timestamp).toLocaleString()}</span>
              </div>
              <span className="truncate text-[14px] text-text-primary">{run.prompt}</span>
              <span className="text-[12px] tabular-nums text-text-tertiary">
                {run.waypointCount} waypoints · {run.blockerCount} blocker{run.blockerCount === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Assistant drawer (D-11): opened from the header overflow ("Draft from description").
 * Same panel style as the inspector; a plain progress line while a draft runs. */
export function AgentConsole() {
  const { consoleOpen, setConsoleOpen, events, status, clearRun } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events]);

  if (!consoleOpen) return null;
  const running = status === 'running';

  return (
    <aside
      aria-label="Assistant"
      className="fixed inset-x-0 bottom-0 top-12 z-40 flex flex-col border-l border-separator-border bg-background-primary-default shadow-fd-float md:bottom-8 md:left-auto md:w-[380px]"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-separator-border pl-4 pr-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-[14px] font-medium text-text-primary">Assistant</h2>
          <p className="text-[12px] text-text-tertiary">Draft from description</p>
        </div>
        {status !== 'idle' && !running && (
          <QuietButton size="xs" onPress={clearRun}>
            Clear
          </QuietButton>
        )}
        <QuietButton iconOnly icon={RiCloseLine} aria-label="Close assistant" onPress={() => setConsoleOpen(false)} />
      </div>
      <div aria-hidden className={cx('h-0.5 shrink-0', running ? 'animate-pulse bg-text-tertiary motion-reduce:animate-none' : 'bg-transparent')} />
      {running && (
        <p role="status" className="sr-only">
          Drafting
        </p>
      )}
      <Tabs className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 px-4 py-2">
          <TabList aria-label="Assistant views" className={SEGMENT_LIST}>
            <Tab id="run" className={SEGMENT_TAB}>
              Draft
            </Tab>
            <Tab id="history" className={SEGMENT_TAB}>
              History
            </Tab>
          </TabList>
        </div>
        <TabPanel id="run" className="flex min-h-0 flex-1 flex-col outline-none">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto border-t border-separator-border">
            {events.length === 0 ? (
              <div className="flex flex-col gap-2 px-4 py-5">
                <p className="text-[14px] text-text-primary">Describe the mission you want.</p>
                <p className="max-w-[40ch] text-[13px] text-text-secondary">
                  The assistant drafts waypoints, then the draft runs through the same pre-flight checks as your plan: zones,
                  altitude limits and endurance. Nothing changes until you load it.
                </p>
              </div>
            ) : (
              <ul>
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            )}
            {(status === 'awaiting_approval' || status === 'needs_human_input') && <ApprovalCard />}
          </div>
          <div className="shrink-0 border-t border-separator-border p-4">
            <MissionPromptBar />
          </div>
        </TabPanel>
        <TabPanel id="history" className="min-h-0 flex-1 overflow-y-auto border-t border-separator-border outline-none">
          <HistoryPanel />
        </TabPanel>
      </Tabs>
    </aside>
  );
}
