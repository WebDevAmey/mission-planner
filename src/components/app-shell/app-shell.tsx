'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { RiSearchLine } from '@remixicon/react';
import { FlightDeckLogo, FlightDeckMark } from '@/components/marketing/logo';
import { CommandPalette } from '@/components/command/command-palette';
import { cx } from '@/utils/cx';
import { AccountMenu } from './account-menu';
import type { ShellMission, ShellUser } from './types';

const NAV = [
  { href: '/dashboard', label: 'Missions' },
  { href: '/settings', label: 'Settings' },
] as const;

export interface AppShellProps {
  user: ShellUser | null;
  /** Missions for the command palette; omit to let the palette load them. */
  missions?: ShellMission[] | null;
  onNewMission?: () => void;
  onImport?: () => void;
  children: ReactNode;
}

/** Shared chrome for the dashboard and settings: 56px top bar, ⌘K palette, account menu. */
export function AppShell({ user, missions, onNewMission, onImport, children }: AppShellProps) {
  const pathname = usePathname();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-background-full text-text-primary">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-[1100] focus:rounded-fd-control focus:bg-background-primary-default focus:px-3 focus:py-2 focus:text-body-2-medium focus:ring-2 focus:ring-border-focus-ring"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-separator-border bg-background-full">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-2 px-4 sm:gap-6 sm:px-6">
          <Link
            href="/dashboard"
            aria-label="Flight Deck, missions"
            className="-ms-1.5 flex h-11 shrink-0 items-center rounded-fd-control px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <FlightDeckMark className="size-6 text-text-primary sm:hidden" />
            <FlightDeckLogo className="hidden sm:inline-flex" />
          </Link>

          <nav aria-label="Primary" className="flex h-full items-stretch">
            {NAV.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx(
                    'relative flex items-center px-2.5 text-body-2-medium outline-none transition-colors duration-150',
                    'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-border-focus-ring',
                    active ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                  )}
                >
                  {item.label}
                  {active && <span aria-hidden className="absolute inset-x-2.5 -bottom-px h-0.5 rounded-full bg-text-primary" />}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Search missions and commands"
            aria-keyshortcuts="Meta+K Control+K"
            className={cx(
              'flex size-11 items-center justify-center rounded-fd-control text-foreground-icon-secondary outline-none transition-colors duration-150',
              'hover:bg-background-secondary-default focus-visible:ring-2 focus-visible:ring-border-focus-ring',
              'md:h-8 md:w-64 md:justify-start md:gap-2 md:border md:border-separator-border md:bg-background-primary-default md:px-2.5 md:hover:border-fd-line-strong md:hover:bg-background-primary-default'
            )}
          >
            <RiSearchLine className="size-4 shrink-0" aria-hidden />
            <span className="hidden flex-1 text-start text-body-2-regular text-text-tertiary md:inline">Search…</span>
            <kbd className="hidden rounded-sm border border-separator-border px-1.5 font-sans text-caption-2-medium text-text-tertiary md:inline">⌘K</kbd>
          </button>

          <AccountMenu user={user} />
        </div>
      </header>

      {children}

      <CommandPalette
        isOpen={paletteOpen}
        onOpenChange={setPaletteOpen}
        missions={missions}
        onNewMission={onNewMission}
        onImport={onImport}
      />
    </div>
  );
}
