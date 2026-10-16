'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftLine,
  RiLayoutRightLine,
  RiMore2Fill,
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
import { cx } from '@/utils/cx';
import { SaveIndicator } from './save-indicator';
import { EditorExportMenu } from './export/export-menu';
import { FOCUS_RING, ICON_BUTTON, MENU_PANEL, TONE_DOT, type Tone } from './editor-styles';
import { useShallow } from 'zustand/react/shallow';

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
    <TooltipTrigger delay={300}>
      <AriaButton aria-label={label} aria-keyshortcuts={shortcut} onPress={onPress} isDisabled={isDisabled} className={ICON_BUTTON}>
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
        onFocus={(e) => e.currentTarget.select()}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="h-8 w-[min(320px,44vw)] min-w-0 rounded-md border border-border-focus-ring bg-background-primary-default px-2 text-[14px] font-medium text-text-primary outline-none"
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
      aria-label={`Mission name: ${name}. Rename`}
      className={cx(
        'h-8 min-w-0 max-w-[min(320px,44vw)] truncate rounded-md px-2 text-start text-[14px] font-medium text-text-primary transition-colors duration-[120ms] hover:bg-background-primary-hover',
        FOCUS_RING
      )}
    >
      {name}
    </button>
  );
}

/** Checks summary: status dot + count + words (never colour alone). Opens the Checks tab. */
function ChecksChip() {
  const analysis = useMissionAnalysis();
  const setTab = useUIStore((s) => s.setInspectorTab);
  if (!analysis) return null;
  const { errors, warnings } = analysis;
  const tone: Tone = errors > 0 ? 'danger' : warnings > 0 ? 'warn' : 'ok';
  const count = errors > 0 ? errors : warnings;
  const words =
    errors > 0 ? (errors === 1 ? 'error' : 'errors') : warnings > 0 ? (warnings === 1 ? 'warning' : 'warnings') : 'Checks pass';
  const label = errors > 0 || warnings > 0 ? `${count} ${words}` : words;
  return (
    <button
      type="button"
      onClick={() => setTab('checks')}
      aria-label={`Pre-flight checks: ${label}${errors > 0 && warnings > 0 ? ` and ${warnings} warning${warnings === 1 ? '' : 's'}` : ''}. Open checks`}
      className={cx(
        'inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-separator-border px-2.5 text-[13px] text-text-secondary transition-colors duration-[120ms] hover:bg-background-primary-hover hover:text-text-primary',
        FOCUS_RING
      )}
    >
      <span aria-hidden className={cx('size-2 shrink-0 rounded-full', TONE_DOT[tone])} />
      {errors > 0 || warnings > 0 ? (
        <span className="whitespace-nowrap">
          <span className="font-medium tabular-nums text-text-primary">{count}</span>
          <span className="hidden sm:inline"> {words}</span>
        </span>
      ) : (
        <span className="hidden whitespace-nowrap sm:inline">{words}</span>
      )}
    </button>
  );
}

/** 48px editor header (DESIGN_SPEC §5.4): back, name, save state | undo, redo,
 * checks, Export (the one accent control), inspector toggle, overflow. Max 8 controls. */
export function EditorHeader() {
  const router = useRouter();
  const mission = useMissionStore((s) => s.mission);
  const undo = useMissionStore((s) => s.undo);
  const redo = useMissionStore((s) => s.redo);
  const canUndo = useMissionStore((s) => s.past.length > 0);
  const canRedo = useMissionStore((s) => s.future.length > 0);
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const { setTemplatePickerOpen, setShortcutsOpen, setParamTableOpen, toggleInspector, addToast } = useUIStore(
    useShallow((s) => ({
      setTemplatePickerOpen: s.setTemplatePickerOpen,
      setShortcutsOpen: s.setShortcutsOpen,
      setParamTableOpen: s.setParamTableOpen,
      toggleInspector: s.toggleInspector,
      addToast: s.addToast,
    }))
  );
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

  const item = 'justify-between gap-4 px-2 py-1.5 text-[14px]';

  return (
    <header className="flex h-12 shrink-0 items-center gap-1 border-b border-separator-border bg-background-primary-default px-2 md:gap-2 md:px-3">
      <TooltipTrigger delay={300}>
        <AriaButton
          aria-label="Back to missions"
          onPress={() => void leave('/dashboard')}
          className={cx(ICON_BUTTON, 'md:w-auto md:gap-1.5 md:px-2 md:text-[13px]')}
        >
          <RiArrowLeftLine className="size-4" aria-hidden />
          <span className="hidden md:inline">Missions</span>
        </AriaButton>
        <Tooltip placement="bottom">Back to missions</Tooltip>
      </TooltipTrigger>
      <span aria-hidden className="hidden h-4 w-px shrink-0 bg-separator-border md:block" />
      <div className="flex min-w-0 items-center gap-1 md:gap-3">
        <MissionName />
        <SaveIndicator className="hidden sm:flex" />
      </div>

      <div className="min-w-2 flex-1" />

      <div className="flex shrink-0 items-center gap-1">
        <div className="hidden items-center sm:flex">
          <HeaderIconButton label="Undo" shortcut="Ctrl Z" onPress={undo} isDisabled={!canUndo}>
            <RiArrowGoBackLine className="size-4" aria-hidden />
          </HeaderIconButton>
          <HeaderIconButton label="Redo" shortcut="Ctrl Y" onPress={redo} isDisabled={!canRedo}>
            <RiArrowGoForwardLine className="size-4" aria-hidden />
          </HeaderIconButton>
        </div>
        <ChecksChip />
        <EditorExportMenu />
        <div className="hidden md:block">
          <HeaderIconButton label={inspectorOpen ? 'Hide inspector' : 'Show inspector'} shortcut="]" onPress={toggleInspector}>
            <RiLayoutRightLine className="size-4" aria-hidden />
          </HeaderIconButton>
        </div>
        <Dropdown isOpen={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownTrigger aria-label="More actions" className={ICON_BUTTON}>
            <RiMore2Fill className="size-4" aria-hidden />
          </DropdownTrigger>
          <DropdownPopover aria-label="More actions" placement="bottom end" className={cx('w-[248px]', MENU_PANEL)}>
            {canUndo && (
              <DropdownItem onSelect={menu(undo)} className={cx(item, 'sm:hidden')}>
                Undo
              </DropdownItem>
            )}
            {canRedo && (
              <DropdownItem onSelect={menu(redo)} className={cx(item, 'sm:hidden')}>
                Redo
              </DropdownItem>
            )}
            <DropdownItem onSelect={menu(() => setTemplatePickerOpen(true))} className={item}>
              Template…
            </DropdownItem>
            <DropdownItem onSelect={menu(() => setConsoleOpen(true))} className={item}>
              Draft from description…
            </DropdownItem>
            <DropdownItem onSelect={menu(() => setParamTableOpen(true))} className={item}>
              Parameter table
            </DropdownItem>
            <DropdownItem onSelect={menu(() => void duplicate())} className={item}>
              Duplicate mission
            </DropdownItem>
            <DropdownItem onSelect={menu(() => setConfirmDelete(true))} className={cx(item, 'text-fd-danger')}>
              Delete mission…
            </DropdownItem>
            <DropdownDivider />
            <DropdownItem onSelect={menu(() => setShortcutsOpen(true))} className={item}>
              Shortcuts
              <Kbd>?</Kbd>
            </DropdownItem>
            <DropdownItem onSelect={menu(() => void leave('/settings'))} className={item}>
              Settings
            </DropdownItem>
            <DropdownItem
              onSelect={menu(async () => {
                await useSaveStore.getState().flush();
                await signOut('/');
              })}
              className={item}
            >
              Sign out
            </DropdownItem>
          </DropdownPopover>
        </Dropdown>
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} size="sm">
        <DialogHeader onClose={() => setConfirmDelete(false)}>
          <DialogTitle className="text-[16px] font-medium">Delete “{mission?.name}”?</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-[14px] text-text-secondary">The mission, its waypoints and zones are removed permanently.</p>
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
