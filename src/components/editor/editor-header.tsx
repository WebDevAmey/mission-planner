'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiAlertLine,
  RiLayoutRightLine,
  RiMore2Fill,
  RiSparkling2Line,
} from '@remixicon/react';
import { Button as AriaButton } from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { Kbd } from '@/components/base/kbd/kbd';
import { Tooltip, TooltipTrigger } from '@/components/base/tooltip/tooltip';
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMissionStore } from '@/lib/store/mission-store';
import { useUIStore } from '@/lib/store/ui-store';
import { useAgentStore } from '@/lib/store/agent-store';
import { useSaveStore } from '@/lib/store/save-store';
import { signOut } from '@/lib/store/local-data';
import { useMissionAnalysis } from '@/hooks/useMissionAnalysis';
import { SaveIndicator } from './save-indicator';
import { EditorExportMenu } from './export/export-menu';
import { cx } from '@/utils/cx';

const ICON_BTN =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-foreground-icon-primary outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-not-allowed disabled:opacity-40';

function HeaderIconButton({
  label,
  shortcut,
  onPress,
  isDisabled,
  children,
}: {
  label: string;
  shortcut?: string;
  onPress: () => void;
  isDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <TooltipTrigger>
      <AriaButton aria-label={label} onPress={onPress} isDisabled={isDisabled} className={ICON_BTN}>
        {children}
      </AriaButton>
      <Tooltip placement="bottom">
        <span className="flex items-center gap-2">
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </span>
      </Tooltip>
    </TooltipTrigger>
  );
}

function MissionName() {
  const name = useMissionStore((s) => s.mission?.name ?? '');
  const rename = useMissionStore((s) => s.updateMissionName);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const commit = () => {
    const v = value.trim();
    if (v && v !== name) rename(v);
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        maxLength={200}
        aria-label="Mission name"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-8 w-[min(320px,40vw)] rounded-lg border border-border-focus-ring bg-background-tertiary-default px-2 text-headline-semibold text-text-primary outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setValue(name);
        setEditing(true);
      }}
      title="Rename mission"
      className="h-8 max-w-[min(320px,40vw)] truncate rounded-lg px-2 text-start text-headline-semibold text-text-primary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
    >
      {name}
    </button>
  );
}

function ChecksBadge() {
  const analysis = useMissionAnalysis();
  const setTab = useUIStore((s) => s.setInspectorTab);
  if (!analysis) return null;
  const { errors, warnings } = analysis;
  const Icon = errors > 0 ? RiErrorWarningLine : warnings > 0 ? RiAlertLine : RiCheckboxCircleLine;
  const label =
    errors > 0
      ? `${errors} error${errors === 1 ? '' : 's'}`
      : warnings > 0
        ? `${warnings} warning${warnings === 1 ? '' : 's'}`
        : 'Checks pass';
  return (
    <button
      type="button"
      onClick={() => setTab('checks')}
      aria-label={`Checks: ${label}. Open checks`}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-body-2-medium outline-none transition-colors hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring',
        errors > 0 ? 'text-red' : warnings > 0 ? 'text-amber' : 'text-text-secondary'
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </button>
  );
}

/** 56px editor header (PRODUCT_SPEC §6.2): back, name, save state, undo/redo,
 * checks, Ask AI, Export, overflow. */
export function EditorHeader() {
  const router = useRouter();
  const mission = useMissionStore((s) => s.mission);
  const undo = useMissionStore((s) => s.undo);
  const redo = useMissionStore((s) => s.redo);
  const canUndo = useMissionStore((s) => s.past.length > 0);
  const canRedo = useMissionStore((s) => s.future.length > 0);
  const { setTemplatePickerOpen, setShortcutsOpen, setParamTableOpen, toggleInspector, addToast } = useUIStore();
  const setConsoleOpen = useAgentStore((s) => s.setConsoleOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const leave = async (href: string) => {
    await useSaveStore.getState().flush();
    router.push(href);
  };

  const menu = (fn: () => void) => () => {
    setMenuOpen(false);
    fn();
  };

  const duplicate = async () => {
    if (!mission) return;
    setBusy(true);
    try {
      await useSaveStore.getState().flush();
      const res = await fetch(`/api/missions/${mission.id}/duplicate`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.mission?.id) throw new Error(data?.error ?? 'Could not duplicate');
      router.push(`/missions/${data.mission.id}`);
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not duplicate the mission', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!mission) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/missions/${mission.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Could not delete the mission');
      useSaveStore.getState().set({ status: 'idle' });
      router.push('/dashboard');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Could not delete the mission', 'error');
      setBusy(false);
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-separator-border bg-background-secondary-default px-3">
      <Button
        variant="ghost"
        size="small"
        leadingIcon={RiArrowLeftLine}
        onClick={() => void leave('/dashboard')}
        aria-label="Back to missions"
        className="shrink-0"
      >
        <span className="hidden md:inline">Missions</span>
      </Button>
      <span aria-hidden className="h-5 w-px shrink-0 bg-separator-border" />
      <div className="flex min-w-0 items-center gap-2">
        <MissionName />
        <SaveIndicator className="hidden sm:flex" />
      </div>

      <div className="flex-1" />

      <div className="flex shrink-0 items-center gap-1">
        <HeaderIconButton label="Undo" shortcut="Ctrl Z" onPress={undo} isDisabled={!canUndo}>
          <RiArrowGoBackLine className="size-[18px]" aria-hidden />
        </HeaderIconButton>
        <HeaderIconButton label="Redo" shortcut="Ctrl Y" onPress={redo} isDisabled={!canRedo}>
          <RiArrowGoForwardLine className="size-[18px]" aria-hidden />
        </HeaderIconButton>
        <span aria-hidden className="mx-1 hidden h-5 w-px bg-separator-border sm:block" />
        <ChecksBadge />
        <Button variant="secondary" size="small" leadingIcon={RiSparkling2Line} onClick={() => setConsoleOpen(true)} className="hidden md:inline-flex">
          Ask AI
        </Button>
        <EditorExportMenu />
        <div className="xl:hidden">
          <HeaderIconButton label="Toggle side panel" shortcut="]" onPress={toggleInspector}>
            <RiLayoutRightLine className="size-[18px]" aria-hidden />
          </HeaderIconButton>
        </div>
        <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownTrigger aria-label="More actions" className={ICON_BTN}>
            <RiMore2Fill className="size-[18px]" aria-hidden />
          </DropdownTrigger>
          <DropdownPopover aria-label="More actions" placement="bottom end" className="w-[240px]">
            <DropdownItem onSelect={menu(() => setConsoleOpen(true))} className="md:hidden">
              Ask AI
            </DropdownItem>
            <DropdownItem onSelect={menu(() => setTemplatePickerOpen(true))}>Apply a template…</DropdownItem>
            <DropdownItem onSelect={menu(() => setParamTableOpen(true))}>Parameter table</DropdownItem>
            <DropdownItem onSelect={menu(() => void duplicate())}>Duplicate mission</DropdownItem>
            <DropdownItem onSelect={menu(() => setConfirmDelete(true))} className="text-red">
              Delete mission…
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem onSelect={menu(() => setShortcutsOpen(true))}>Keyboard shortcuts</DropdownItem>
            <DropdownItem onSelect={menu(() => void leave('/settings'))}>Account settings</DropdownItem>
            <DropdownItem
              onSelect={menu(async () => {
                await useSaveStore.getState().flush();
                await signOut('/');
              })}
            >
              Sign out
            </DropdownItem>
          </DropdownPopover>
        </Dropdown>
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} size="sm">
        <DialogHeader onClose={() => setConfirmDelete(false)}>
          <DialogTitle className="text-sm">Delete “{mission?.name}”?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-body-2-regular text-text-secondary">The mission, its waypoints and zones are removed permanently.</p>
        </DialogBody>
        <DialogFooter>
          <Button size="small" variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button size="small" variant="danger" disabled={busy} onClick={() => void remove()}>
            Delete mission
          </Button>
        </DialogFooter>
      </Dialog>
    </header>
  );
}
