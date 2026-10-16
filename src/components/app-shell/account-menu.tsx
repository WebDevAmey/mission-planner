'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiLogoutBoxRLine, RiSettings3Line } from '@remixicon/react';
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown';
import { ThemeToggle } from '@/components/application/theme/theme-toggle';
import { signOut } from '@/lib/store/local-data';
import type { ShellUser } from './types';

export function initialsOf(user: ShellUser | null): string {
  const source = user?.name?.trim() || user?.email || '';
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts.length >= 2 ? parts[0][0] + parts[1][0] : source.slice(0, 2)).toUpperCase();
  return letters || '·';
}

/** Avatar button with the account menu: who is signed in, theme, settings, sign out. */
export function AccountMenu({ user }: { user: ShellUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <Dropdown isOpen={open} onOpenChange={setOpen}>
      <DropdownTrigger
        aria-label="Account menu"
        className="flex size-11 items-center justify-center rounded-full sm:size-9"
      >
        <span className="flex size-8 items-center justify-center rounded-full border border-separator-border bg-background-secondary-default text-caption-1-medium text-text-primary transition-colors duration-150 hover:border-(color:--fd-line-strong)">
          {initialsOf(user)}
        </span>
      </DropdownTrigger>
      <DropdownPopover aria-label="Account" placement="bottom end" className="w-[260px]">
        <div className="flex min-w-0 flex-col px-2 pt-1 pb-0.5">
          <span className="truncate text-body-2-medium text-text-primary">{user?.name || 'Signed in'}</span>
          <span className="truncate text-caption-1-regular text-text-secondary">{user?.email ?? ''}</span>
        </div>
        <DropdownDivider />
        <div className="flex items-center justify-between gap-3 px-2 py-0.5">
          <span className="text-body-2-regular text-text-secondary">Theme</span>
          <ThemeToggle appearance="segmented" size="small" />
        </div>
        <DropdownDivider />
        <DropdownItem
          onSelect={() => {
            setOpen(false);
            router.push('/settings');
          }}
        >
          <RiSettings3Line className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span>Settings</span>
        </DropdownItem>
        <DropdownItem
          onSelect={() => {
            setOpen(false);
            void signOut('/');
          }}
        >
          <RiLogoutBoxRLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          <span>Sign out</span>
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  );
}
