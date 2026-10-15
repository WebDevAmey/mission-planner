'use client';

import { useEffect, useRef, useState } from 'react';
import {
  RiCheckLine,
  RiCloseLine,
  RiDownloadLine,
  RiRobot2Line,
  RiShieldCheckLine,
  RiShieldLine,
  RiTerminalLine,
} from '@remixicon/react';
import { Button } from '@/components/base/buttons/button';
import { Tab, TabList, TabPanel, Tabs } from '@/components/base/tabs/tabs';
import { useAgentStore } from '@/lib/store/agent-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { buildMissionItemsFromDraft } from '@/lib/agents/sentinel-audit';
import type { AgentEvent } from '@/lib/agents/schemas';
import { cx } from '@/utils/cx';
import { MissionPromptBar } from './mission-prompt-bar';

const AGENT_TEXT: Record<AgentEvent['agent'], string> = {
  ATLAS: 'text-blue',
  SENTINEL: 'text-amber',
  SYSTEM: 'text-text-secondary',
};

function AgentIcon({ agent }: { agent: AgentEvent['agent'] }) {
  const cls = cx('size-4 shrink-0', AGENT_TEXT[agent]);
  if (agent === 'ATLAS') return <RiRobot2Line className={cls} aria-hidden />;
  if (agent === 'SENTINEL') return <RiShieldCheckLine className={cls} aria-hidden />;
  return <RiTerminalLine className={cls} aria-hidden />;
}

function EventRow({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const hasDetail = event.type === 'tool_call' || event.type === 'tool_result';
  const isVeto = event.type === 'audit' && event.payload.verdict === 'VETO';

  return (
    <li
      className={cx(
        'rounded-lg border px-3 py-2',
        isVeto ? 'border-red bg-red-bg' : event.type === 'audit' ? 'border-green bg-green-bg' : 'border-separator-border'
      )}
    >
      <div className="flex items-center gap-2">
        <AgentIcon agent={event.agent} />
        <span className="min-w-0 flex-1 text-body-2-medium text-text-primary">{event.title}</span>
        {hasDetail && (
          <Button size="xs" variant="ghost" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
            {open ? 'Hide' : 'Details'}
          </Button>
        )}
      </div>
      {open && hasDetail && (
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-caption-1-regular text-text-secondary">
          {event.detail}
        </pre>
      )}
      {event.type === 'audit' && (
        <div className="mt-2 flex flex-col gap-1">
          <span className="text-caption-1-regular text-text-secondary">Risk score {event.payload.riskScore.toFixed(0)}/100</span>
          {event.payload.findings.map((f, i) => (
            <span
              key={i}
              className={cx(
                'text-caption-1-regular',
                f.severity === 'blocker' ? 'text-red' : f.severity === 'warning' ? 'text-amber' : 'text-text-secondary'
              )}
            >
              {f.message}
            </span>
          ))}
        </div>
      )}
      {event.type === 'error' && <p className="mt-1 text-caption-1-regular text-red">{event.detail}</p>}
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
    replaceItems(buildMissionItemsFromDraft(result.draftMission, mission.settings), 'Load Flight Deck draft');
    addToast('Flight Deck draft loaded', 'success', { label: 'Undo', onClick: () => useMissionStore.getState().undo() });
    clearRun();
  };

  return (
    <div className={cx('flex flex-col gap-3 rounded-lg border p-3', isVeto ? 'border-red' : 'border-green')}>
      <div className="flex items-center gap-2">
        {isVeto ? <RiShieldLine className="size-4 text-red" aria-hidden /> : <RiShieldCheckLine className="size-4 text-green" aria-hidden />}
        <span className="text-body-2-semibold text-text-primary">
          {isVeto ? `Not cleared after ${result.vetoCount} attempts` : 'Checks passed: ready to load'}
        </span>
      </div>
      <p className="text-caption-1-regular text-text-secondary">
        {result.draftMission.waypoints.length} waypoints proposed.
        {isVeto ? ' Review the blockers above, adjust the request and try again.' : ' Loading replaces the current items as one undo step.'}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          size="small"
          variant="secondary"
          onClick={() => {
            clearRun();
            setConsoleOpen(false);
          }}
        >
          Discard
        </Button>
        {!isVeto && (
          <Button size="small" variant="primary" leadingIcon={RiCheckLine} onClick={approve}>
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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-caption-1-regular text-text-secondary">
          {history.length} run{history.length === 1 ? '' : 's'} on this device
        </span>
        {history.length > 0 && (
          <>
            <Button size="xs" variant="ghost" leadingIcon={RiDownloadLine} onClick={exportLog}>
              Export
            </Button>
            <Button size="xs" variant="ghost" onClick={clearHistory}>
              Clear
            </Button>
          </>
        )}
      </div>
      {history.length === 0 ? (
        <p className="py-8 text-center text-body-2-regular text-text-secondary">Completed runs appear here as an audit trail.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {history.map((run) => (
            <li key={run.id} className="flex flex-col gap-1 rounded-lg border border-separator-border px-3 py-2">
              <div className="flex items-center gap-2">
                <span
                  className={cx(
                    'text-caption-1-semibold',
                    run.status === 'approved_ready' ? 'text-green' : 'text-red'
                  )}
                >
                  {run.status === 'approved_ready' ? 'Passed' : run.status === 'needs_human_input' ? 'Vetoed' : 'Error'}
                </span>
                <span className="flex-1 text-end text-caption-1-regular text-text-tertiary">{new Date(run.timestamp).toLocaleString()}</span>
              </div>
              <span className="truncate text-body-2-medium text-text-primary">{run.prompt}</span>
              <span className="text-caption-1-regular text-text-secondary">
                {run.waypointCount} waypoints · {run.blockerCount} blocker{run.blockerCount === 1 ? '' : 's'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Flight Deck drawer: prompt, live run and audit log. Sits over the inspector column. */
export function AgentConsole() {
  const { consoleOpen, setConsoleOpen, events, status, clearRun } = useAgentStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events]);

  if (!consoleOpen) return null;

  return (
    <aside
      aria-label="Flight Deck"
      className="fixed inset-x-0 bottom-10 top-14 z-40 flex flex-col border-l border-separator-border bg-background-primary-default shadow-2xl sm:left-auto sm:w-[360px]"
    >
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-separator-border px-4">
        <RiRobot2Line className="size-5 text-text-secondary" aria-hidden />
        <h2 className="flex-1 text-body-semibold text-text-primary">Ask AI</h2>
        {status !== 'idle' && status !== 'running' && (
          <Button size="xs" variant="ghost" onClick={clearRun}>
            Clear
          </Button>
        )}
        <Button size="small" variant="ghost" iconOnly leadingIcon={RiCloseLine} aria-label="Close" onClick={() => setConsoleOpen(false)} />
      </div>
      <Tabs className="min-h-0 flex-1 gap-0">
        <TabList aria-label="Flight Deck views" className="px-4">
          <Tab id="run">Run</Tab>
          <Tab id="history">Audit log</Tab>
        </TabList>
        <TabPanel id="run" className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
            {events.length === 0 ? (
              <p className="py-8 text-center text-body-2-regular text-text-secondary">
                Describe the mission below. ATLAS drafts it and SENTINEL checks it against your zones and limits.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {events.map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
            )}
            {(status === 'awaiting_approval' || status === 'needs_human_input') && (
              <div className="mt-3">
                <ApprovalCard />
              </div>
            )}
          </div>
          <div className="border-t border-separator-border p-4">
            <MissionPromptBar />
          </div>
        </TabPanel>
        <TabPanel id="history" className="min-h-0 flex-1 overflow-y-auto p-4">
          <HistoryPanel />
        </TabPanel>
      </Tabs>
    </aside>
  );
}
