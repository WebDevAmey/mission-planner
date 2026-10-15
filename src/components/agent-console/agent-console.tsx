'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Bot, Terminal, Check, XCircle, History, Download } from 'lucide-react';
import { useAgentStore } from '@/lib/store/agent-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { buildMissionItemsFromDraft } from '@/lib/agents/sentinel-audit';
import type { AgentEvent } from '@/lib/agents/schemas';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

const AGENT_TEXT_CLASS: Record<AgentEvent['agent'], string> = {
  ATLAS: 'text-blue',
  SENTINEL: 'text-amber',
  SYSTEM: 'text-text-dim',
};

function AgentIcon({ agent }: { agent: AgentEvent['agent'] }) {
  const className = AGENT_TEXT_CLASS[agent];
  if (agent === 'ATLAS') return <Bot size={13} className={className} />;
  if (agent === 'SENTINEL') return <ShieldCheck size={13} className={className} />;
  return <Terminal size={13} className={className} />;
}

function EventRow({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const hasDetail = event.type === 'tool_call' || event.type === 'tool_result';
  const isVeto = event.type === 'audit' && event.payload.verdict === 'VETO';

  return (
    <div
      className={cn(
        'mb-1.5 rounded-sm border px-2.5 py-1.5',
        isVeto
          ? 'border-red bg-red-bg'
          : event.type === 'audit'
            ? 'border-green-dim bg-green-bg'
            : 'border-border-mid bg-bg-raised'
      )}
    >
      <div className="flex items-center gap-1.5">
        <AgentIcon agent={event.agent} />
        <span className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', AGENT_TEXT_CLASS[event.agent])}>
          {event.agent}
        </span>
        <span className="flex-1 font-mono text-[10px] text-text">{event.title}</span>
        {hasDetail && (
          <button onClick={() => setOpen((v) => !v)} className="font-mono text-[9px] text-text-muted transition-colors hover:text-text">
            {open ? 'hide' : 'details'}
          </button>
        )}
      </div>

      {open && (event.type === 'tool_call' || event.type === 'tool_result') && (
        <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[9px] text-text-dim">
          {event.detail}
        </pre>
      )}

      {event.type === 'audit' && (
        <div className="mt-1.5">
          <div className="mb-1 font-mono text-[9px] text-text-dim">
            Risk score: {event.payload.riskScore.toFixed(0)}/100
          </div>
          {event.payload.findings.map((f, i) => (
            <div
              key={i}
              className={cn(
                'py-0.5 font-mono text-[9px]',
                f.severity === 'blocker' ? 'text-red' : f.severity === 'warning' ? 'text-amber' : 'text-text-muted'
              )}
            >
              [{f.severity}] {f.message}
            </div>
          ))}
        </div>
      )}

      {event.type === 'error' && (
        <div className="mt-1 font-mono text-[9px] text-red">{event.detail}</div>
      )}
    </div>
  );
}

function ApprovalCard() {
  const { result, clearRun, setConsoleOpen } = useAgentStore();
  const { mission, replaceItems } = useMissionStore();
  const { addToast } = useUIStore();

  if (!result || !result.draftMission) return null;

  const isVeto = result.status === 'needs_human_input';

  const approve = () => {
    if (!mission || !result.draftMission) return;
    const items = buildMissionItemsFromDraft(result.draftMission, mission.settings);
    replaceItems(items, 'Load Flight Deck draft');
    addToast('Flight Deck draft loaded. Undo to restore your previous items.', 'success');
    clearRun();
  };

  const discard = () => {
    addToast('Flight Deck draft discarded', 'info');
    clearRun();
    setConsoleOpen(false);
  };

  return (
    <div className={cn('mt-1 rounded-md border bg-bg-raised p-2.5', isVeto ? 'border-red' : 'border-green')}>
      <div className="mb-2 flex items-center gap-1.5">
        {isVeto ? <ShieldAlert size={14} className="text-red" /> : <ShieldCheck size={14} className="text-green" />}
        <span className="font-mono text-[11px] font-bold text-text">
          {isVeto ? `SENTINEL could not clear this mission after ${result.vetoCount} attempts` : 'SENTINEL passed — ready for your approval'}
        </span>
      </div>
      <div className="mb-2.5 font-mono text-[9px] text-text-dim">
        {result.draftMission.waypoints.length} waypoints proposed.
        {isVeto ? ' Review the blockers above, edit the request, and try again.' : ' Nothing is written to your mission until you approve.'}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={discard} className="font-mono">
          <XCircle size={11} /> Discard
        </Button>
        {!isVeto && (
          <Button
            size="sm"
            onClick={approve}
            className="border-green bg-green-bg font-mono font-bold text-green hover:bg-green/20"
          >
            <Check size={11} /> Approve &amp; Load
          </Button>
        )}
      </div>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  approved_ready: 'PASS',
  needs_human_input: 'VETO',
  error: 'ERROR',
};

const STATUS_CLASS: Record<string, string> = {
  approved_ready: 'text-green',
  needs_human_input: 'text-red',
  error: 'text-red',
};

/** Read-only audit trail of past Flight Deck runs — every prompt ATLAS drafted and
 * every verdict SENTINEL returned, persisted on-device so an operator can produce a
 * planning record for a given flight after the fact. */
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
    <div className="p-2.5">
      <div className="mb-2 flex items-center gap-1.5">
        <span className="flex-1 font-mono text-[9px] text-text-dim">
          {history.length} run{history.length === 1 ? '' : 's'} recorded on this device
        </span>
        {history.length > 0 && (
          <>
            <button onClick={exportLog} title="Export audit log as JSON" className="flex items-center gap-1 font-mono text-[9px] text-text-muted transition-colors hover:text-text">
              <Download size={10} /> export
            </button>
            <button onClick={clearHistory} title="Clear history" className="font-mono text-[9px] text-text-muted transition-colors hover:text-text">
              clear
            </button>
          </>
        )}
      </div>

      {history.length === 0 && (
        <EmptyState icon={History} title="No runs yet" description="Completed Flight Deck runs land here as an audit trail." />
      )}

      {history.map((run) => (
        <div key={run.id} className="mb-1.5 rounded-sm border border-border-mid bg-bg-raised px-2.5 py-1.5">
          <div className="mb-0.5 flex items-center gap-1.5">
            <span className={cn('font-mono text-[9px] font-bold', STATUS_CLASS[run.status] ?? 'text-text-muted')}>
              {STATUS_LABEL[run.status] ?? run.status.toUpperCase()}
            </span>
            <span className="flex-1 text-right font-mono text-[9px] text-text-muted">
              {new Date(run.timestamp).toLocaleString()}
            </span>
          </div>
          <div className="mb-0.5 truncate font-mono text-[10px] text-text">
            {run.prompt}
          </div>
          <div className="font-mono text-[9px] text-text-dim">
            {run.waypointCount} waypoints · risk {run.riskScore !== null ? run.riskScore.toFixed(0) : '—'}/100 · {run.blockerCount} blocker{run.blockerCount === 1 ? '' : 's'} · {run.vetoCount} veto{run.vetoCount === 1 ? '' : 's'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AgentConsole() {
  const { consoleOpen, setConsoleOpen, events, status, clearRun } = useAgentStore();
  const [tab, setTab] = useState<'run' | 'history'>('run');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [events]);

  if (!consoleOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 top-[70px] z-[1000] flex w-[340px] flex-col overflow-hidden rounded-md border border-border-mid bg-bg-panel shadow-2xl">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-border-mid px-3 py-2">
        <Bot size={13} className="text-cyan" />
        <span className="flex-1 font-mono text-[11px] font-bold uppercase tracking-wide text-text">
          Flight Deck
        </span>
        {tab === 'run' && status !== 'idle' && status !== 'running' && (
          <button onClick={clearRun} title="Clear run" className="font-mono text-[9px] text-text-muted transition-colors hover:text-text">
            clear
          </button>
        )}
        <button onClick={() => setConsoleOpen(false)} aria-label="Close Flight Deck console" className="text-text-muted transition-colors hover:text-text">
          <X size={13} />
        </button>
      </div>

      <div className="flex shrink-0 gap-3.5 border-b border-border-mid px-3 pt-2">
        <button
          onClick={() => setTab('run')}
          className={cn(
            'flex items-center gap-1 border-b-2 pb-0.5 font-mono text-[9px] font-bold',
            tab === 'run' ? 'border-cyan text-text' : 'border-transparent text-text-muted'
          )}
        >
          <Terminal size={10} /> Run
        </button>
        <button
          onClick={() => setTab('history')}
          className={cn(
            'flex items-center gap-1 border-b-2 pb-0.5 font-mono text-[9px] font-bold',
            tab === 'history' ? 'border-cyan text-text' : 'border-transparent text-text-muted'
          )}
        >
          <History size={10} /> Audit log
        </button>
      </div>

      {tab === 'run' ? (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-2.5">
          {events.length === 0 && (
            <EmptyState title="No activity yet" description="Ask Flight Deck to plan a mission using the prompt bar above the map." />
          )}
          {events.map((event) => <EventRow key={event.id} event={event} />)}
          {(status === 'awaiting_approval' || status === 'needs_human_input') && <ApprovalCard />}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <HistoryPanel />
        </div>
      )}
    </div>
  );
}
