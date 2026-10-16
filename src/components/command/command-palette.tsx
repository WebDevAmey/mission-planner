'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Autocomplete,
  Dialog,
  Header,
  Input,
  Menu,
  MenuItem,
  MenuSection,
  Modal,
  ModalOverlay,
  SearchField,
  useFilter,
  type Key,
} from 'react-aria-components';
import {
  RiAddLine,
  RiContrast2Line,
  RiLogoutBoxRLine,
  RiRouteLine,
  RiSearchLine,
  RiSettings3Line,
  RiStackLine,
  RiUpload2Line,
  type RemixiconComponentType,
} from '@remixicon/react';
import { applyTheme } from '@/components/application/theme/theme-toggle';
import { signOut } from '@/lib/store/local-data';
import { cx } from '@/utils/cx';
import type { ShellMission } from '@/components/app-shell/types';

interface Command {
  id: string;
  label: string;
  icon: RemixiconComponentType;
  hint?: string;
}

export interface CommandPaletteProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Missions to jump to. `undefined` = load them from the API when opened. */
  missions?: ShellMission[] | null;
  /** Opens the new-mission dialog on this page; without it the command goes to the dashboard. */
  onNewMission?: () => void;
  /** Opens the import file picker; the command is hidden when absent. */
  onImport?: () => void;
}

const itemClass = ({ isFocused, isPressed }: { isFocused: boolean; isPressed: boolean }) =>
  cx(
    'flex h-10 cursor-pointer items-center gap-3 rounded-md px-2.5 text-body-2-regular text-text-primary outline-none',
    isFocused && 'bg-background-secondary-default',
    isPressed && 'bg-background-secondary-hover'
  );

function CommandRow({ id, label, icon: Icon, hint }: Command) {
  return (
    <MenuItem id={id} textValue={label} className={itemClass}>
      <Icon className="size-4 shrink-0 text-foreground-icon-secondary" aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="shrink-0 text-caption-1-regular text-text-tertiary">{hint}</span>}
    </MenuItem>
  );
}

const sectionHeader = 'px-2.5 pt-2 pb-1 text-caption-1-medium text-text-tertiary';

/** ⌘K palette: commands plus "open a mission by name". */
export function CommandPalette({ isOpen, onOpenChange, missions, onNewMission, onImport }: CommandPaletteProps) {
  const router = useRouter();
  const { contains } = useFilter({ sensitivity: 'base' });
  const [fetched, setFetched] = useState<ShellMission[] | null>(null);

  // Pages without a mission list (settings) load it the first time the palette opens.
  useEffect(() => {
    if (!isOpen || missions !== undefined || fetched) return;
    let cancelled = false;
    fetch('/api/missions')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { missions?: ShellMission[] } | null) => {
        if (!cancelled && d?.missions) setFetched(d.missions.map((m) => ({ id: m.id, name: m.name })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isOpen, missions, fetched]);

  const list = (missions === undefined ? fetched : missions) ?? [];

  const commands: Command[] = [
    { id: 'new', label: 'New mission', icon: RiAddLine },
    ...(onImport ? [{ id: 'import', label: 'Import file', icon: RiUpload2Line, hint: '.plan .waypoints .json' }] : []),
    { id: 'missions', label: 'Go to missions', icon: RiStackLine },
    { id: 'settings', label: 'Settings', icon: RiSettings3Line },
    { id: 'theme', label: 'Toggle theme', icon: RiContrast2Line },
    { id: 'signout', label: 'Sign out', icon: RiLogoutBoxRLine },
  ];

  const run = (key: Key) => {
    const k = String(key);
    onOpenChange(false);
    if (k.startsWith('m:')) return router.push(`/missions/${k.slice(2)}`);
    switch (k) {
      case 'new':
        return onNewMission ? onNewMission() : router.push('/dashboard?new=1');
      case 'import':
        return onImport?.();
      case 'missions':
        return router.push('/dashboard');
      case 'settings':
        return router.push('/settings');
      case 'theme':
        return applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
      case 'signout':
        return void signOut('/');
    }
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className={({ isEntering }) =>
        cx(
          'fixed inset-0 z-[1000] flex items-start justify-center bg-black/40 px-4 pt-[12dvh]',
          isEntering && 'motion-safe:animate-[fadeIn_160ms_ease-out]'
        )
      }
    >
      <Modal className="w-full max-w-[560px] overflow-hidden rounded-2lg border border-separator-border bg-background-primary-default shadow-(--fd-shadow-float) outline-none">
        <Dialog aria-label="Command palette" className="outline-none">
          <Autocomplete filter={contains}>
            <SearchField aria-label="Search missions and commands" autoFocus className="flex items-center gap-2.5 border-b border-separator-border px-3.5">
              <RiSearchLine className="size-[18px] shrink-0 text-foreground-icon-secondary" aria-hidden />
              <Input
                placeholder="Search missions and commands"
                className="h-12 min-w-0 flex-1 bg-transparent text-body-regular text-text-primary outline-none placeholder:text-text-tertiary [&::-webkit-search-cancel-button]:hidden"
              />
              <kbd className="hidden rounded-sm border border-separator-border px-1.5 py-0.5 font-sans text-caption-2-medium text-text-tertiary sm:inline">Esc</kbd>
            </SearchField>
            <Menu
              aria-label="Commands"
              onAction={run}
              className="max-h-[min(60dvh,420px)] overflow-y-auto p-1.5 outline-none"
              renderEmptyState={() => <p className="px-3 py-8 text-center text-body-2-regular text-text-secondary">No missions or commands match.</p>}
            >
              <MenuSection>
                <Header className={sectionHeader}>Commands</Header>
                {commands.map((c) => (
                  <CommandRow key={c.id} {...c} />
                ))}
              </MenuSection>
              {list.length > 0 && (
                <MenuSection>
                  <Header className={sectionHeader}>Missions</Header>
                  {list.map((m) => (
                    <CommandRow key={m.id} id={`m:${m.id}`} label={m.name} icon={RiRouteLine} />
                  ))}
                </MenuSection>
              )}
            </Menu>
          </Autocomplete>
          <div className="hidden items-center gap-4 border-t border-separator-border px-3.5 py-2 text-caption-1-regular text-text-tertiary sm:flex">
            <span>↑ ↓ to move</span>
            <span>Enter to open</span>
            <span>Esc to close</span>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
