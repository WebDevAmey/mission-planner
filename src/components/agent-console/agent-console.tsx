'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, ShieldAlert, Bot, Terminal, Check, XCircle, History, Download } from 'lucide-react';
import { useAgentStore } from '@/lib/store/agent-store';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { buildMissionItemsFromDraft } from '@/lib/agents/sentinel-audit';
import type { AgentEvent } from '@/lib/agents/schemas';

const AGENT_COLOR: Record<AgentEvent['agent'], string> = {
  ATLAS: 'var(--color-blue)',
  SENTINEL: 'var(--color-amber)',
  SYSTEM: 'var(--color-text-dim)',
};

function AgentIcon({ agent }: { agent: AgentEvent['agent'] }) {
  const color = AGENT_COLOR[agent];
  if (agent === 'ATLAS') return <Bot size={13} color={color} />;
  if (agent === 'SENTINEL') return <ShieldCheck size={13} color={color} />;
  return <Terminal size={13} color={color} />;
}

function EventRow({ event }: { event: AgentEvent }) {
  const [open, setOpen] = useState(false);
  const color = AGENT_COLOR[event.agent];
  const hasDetail = event.type === 'tool_call' || event.type === 'tool_result';
  const isVeto = event.type === 'audit' && event.payload.verdict === 'VETO';

  return (
    <div style={{
      padding: '7px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px',
      backgroundColor: isVeto ? 'var(--color-red-bg)' : event.type === 'audit' ? 'var(--color-green-bg)' : 'var(--color-bg-raised)',
      border: `1px solid ${isVeto ? 'var(--color-red)' : event.type === 'audit' ? 'var(--color-green-dim)' : 'var(--color-border-mid)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <AgentIcon agent={event.agent} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
          {event.agent}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text)', flex: 1 }}>
          {event.title}
        </span>
        {hasDetail && (
          <button onClick={() => setOpen((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
            {open ? 'hide' : 'details'}
          </button>
        )}
      </div>

      {open && (event.type === 'tool_call' || event.type === 'tool_result') && (
        <pre style={{ marginTop: '6px', fontSize: '9px', fontFamily: 'var(--font-mono)', color: 'var(--color-text-dim)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '160px', overflow: 'auto' }}>
          {event.detail}
        </pre>
      )}

      {event.type === 'audit' && (
        <div style={{ marginTop: '6px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)', marginBottom: '4px' }}>
            Risk score: {event.payload.riskScore.toFixed(0)}/100
          </div>
          {event.payload.findings.map((f, i) => (
            <div key={i} style={{
              fontFamily: 'var(--font-mono)', fontSize: '9px', padding: '2px 0',
              color: f.severity === 'blocker' ? 'var(--color-red)' : f.severity === 'warning' ? 'var(--color-amber)' : 'var(--color-text-muted)',
            }}>
              [{f.severity}] {f.message}
            </div>
          ))}
        </div>
      )}

      {event.type === 'error' && (
        <div style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-red)' }}>
          {event.detail}
        </div>
      )}
    </div>
  );
}

function ApprovalCard() {
  const { result, clearRun, setConsoleOpen } = useAgentStore();
  const { mission, loadMission } = useMissionStore();
  const { addToast } = useUIStore();

  if (!result || !result.draftMission) return null;

  const isVeto = result.status === 'needs_human_input';

  const approve = () => {
    if (!mission || !result.draftMission) return;
    const items = buildMissionItemsFromDraft(result.draftMission, mission.settings);
    loadMission({ ...mission, items, updatedAt: new Date().toISOString() });
    addToast('✓ Flight Deck mission applied', 'success');
    clearRun();
  };

  const discard = () => {
    addToast('Flight Deck draft discarded', 'info');
    clearRun();
    setConsoleOpen(false);
  };

  return (
    <div style={{
      padding: '10px', borderRadius: 'var(--radius-md)', marginTop: '4px',
      backgroundColor: 'var(--color-bg-raised)', border: `1px solid ${isVeto ? 'var(--color-red)' : 'var(--color-green)'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        {isVeto ? <ShieldAlert size={14} color="var(--color-red)" /> : <ShieldCheck size={14} color="var(--color-green)" />}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text)' }}>
          {isVeto ? `SENTINEL could not clear this mission after ${result.vetoCount} attempts` : 'SENTINEL passed — ready for your approval'}
        </span>
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)', marginBottom: '10px' }}>
        {result.draftMission.waypoints.length} waypoints proposed.
        {isVeto ? ' Review the blockers above, edit the request, and try again.' : ' Nothing is written to your mission until you approve.'}
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={discard} style={{
          display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', background: 'none',
          border: '1px solid var(--color-border-mid)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-muted)',
          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px',
        }}>
          <XCircle size={11} /> Discard
        </button>
        {!isVeto && (
          <button onClick={approve} style={{
            display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 12px', backgroundColor: 'var(--color-green-bg)',
            border: '1px solid var(--color-green)', borderRadius: 'var(--radius-sm)', color: 'var(--color-green)',
            cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700,
          }}>
            <Check size={11} /> Approve &amp; Load
          </button>
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

const STATUS_COLOR: Record<string, string> = {
  approved_ready: 'var(--color-green)',
  needs_human_input: 'var(--color-red)',
  error: 'var(--color-red)',
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
    <div style={{ padding: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)', flex: 1 }}>
          {history.length} run{history.length === 1 ? '' : 's'} recorded on this device
        </span>
        {history.length > 0 && (
          <>
            <button onClick={exportLog} title="Export audit log as JSON" style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
              <Download size={10} /> export
            </button>
            <button onClick={clearHistory} title="Clear history" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
              clear
            </button>
          </>
        )}
      </div>

      {history.length === 0 && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '24px' }}>
          No runs yet. Completed Flight Deck runs land here as an audit trail.
        </div>
      )}

      {history.map((run) => (
        <div key={run.id} style={{
          padding: '7px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '6px',
          backgroundColor: 'var(--color-bg-raised)', border: '1px solid var(--color-border-mid)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700, color: STATUS_COLOR[run.status] ?? 'var(--color-text-muted)' }}>
              {STATUS_LABEL[run.status] ?? run.status.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-muted)', flex: 1, textAlign: 'right' }}>
              {new Date(run.timestamp).toLocaleString()}
            </span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text)', marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {run.prompt}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-text-dim)' }}>
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

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', cursor: 'pointer',
    fontFamily: 'var(--font-mono)', fontSize: '9px', fontWeight: 700,
    color: active ? 'var(--color-text)' : 'var(--color-text-muted)',
    padding: '2px 0', borderBottom: active ? '2px solid var(--color-cyan)' : '2px solid transparent',
  });

  return (
    <div style={{
      position: 'fixed', top: '70px', right: '16px', bottom: '16px', width: '340px', zIndex: 1000,
      backgroundColor: 'var(--color-bg-panel)', border: '1px solid var(--color-border-mid)',
      borderRadius: 'var(--radius-md)', boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', borderBottom: '1px solid var(--color-border-mid)', flexShrink: 0 }}>
        <Bot size={13} color="var(--color-cyan)" />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text)', textTransform: 'uppercase', letterSpacing: '0.5px', flex: 1 }}>
          Flight Deck
        </span>
        {tab === 'run' && status !== 'idle' && status !== 'running' && (
          <button onClick={clearRun} title="Clear run" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '9px', fontFamily: 'var(--font-mono)' }}>
            clear
          </button>
        )}
        <button onClick={() => setConsoleOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
          <X size={13} />
        </button>
      </div>

      <div style={{ display: 'flex', gap: '14px', padding: '8px 12px 0', borderBottom: '1px solid var(--color-border-mid)', flexShrink: 0 }}>
        <button onClick={() => setTab('run')} style={tabBtnStyle(tab === 'run')}>
          <Terminal size={10} /> Run
        </button>
        <button onClick={() => setTab('history')} style={tabBtnStyle(tab === 'history')}>
          <History size={10} /> Audit log
        </button>
      </div>

      {tab === 'run' ? (
        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
          {events.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '24px' }}>
              Ask Flight Deck to plan a mission using the prompt bar above the map.
            </div>
          )}
          {events.map((event) => <EventRow key={event.id} event={event} />)}
          {(status === 'awaiting_approval' || status === 'needs_human_input') && <ApprovalCard />}
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <HistoryPanel />
        </div>
      )}
    </div>
  );
}
