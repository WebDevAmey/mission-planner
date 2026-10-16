'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { RiCloseLine } from '@remixicon/react';
import { cx } from '@/utils/cx';
import { FlightDeckLogo } from './logo';
import { button, focusRing, wrap } from './styles';

export const NAV_LINKS = [
  { label: 'Product', href: '#capabilities' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Formats', href: '#formats' },
  { label: 'FAQ', href: '#faq' },
];

const navLink = `rounded-[2px] px-2 py-1 text-[15px]/[20px] text-(--fd-ink-2) transition-colors duration-[120ms] hover:text-(--fd-ink) ${focusRing}`;

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Keep the page behind the sheet from scrolling while it is open.
  useEffect(() => {
    document.documentElement.classList.toggle('overflow-hidden', open);
    return () => document.documentElement.classList.remove('overflow-hidden');
  }, [open]);

  const openMenu = () => {
    dialogRef.current?.showModal(); // native modal: focus is trapped, Escape closes
    setOpen(true);
  };
  const closeMenu = () => dialogRef.current?.close();

  return (
    <header className="sticky top-0 z-40 border-b border-(--fd-line) bg-(--fd-bg)">
      <div className={cx(wrap, 'flex h-16 items-center gap-6')}>
        <Link href="/" aria-label="Flight Deck home" className={cx('rounded-[2px]', focusRing)}>
          <FlightDeckLogo />
        </Link>

        <nav aria-label="Primary" className="ml-4 hidden items-center gap-4 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className={navLink}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link href="/login" className={cx(navLink, 'hidden sm:inline-flex')}>
            Sign in
          </Link>
          <Link href="/signup" className={cx(button.primary, button.small)}>
            Start planning
          </Link>
          <button
            ref={menuButtonRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-controls="site-menu"
            onClick={openMenu}
            className={cx(
              'inline-flex h-9 items-center rounded-[2px] border border-(--fd-line-strong) px-3 text-[14px]/[20px] text-(--fd-ink) md:hidden',
              focusRing,
            )}
          >
            Menu
          </button>
        </div>
      </div>

      <dialog
        id="site-menu"
        ref={dialogRef}
        aria-label="Menu"
        onClose={() => {
          setOpen(false);
          menuButtonRef.current?.focus();
        }}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-(--fd-bg) p-0 text-(--fd-ink) backdrop:bg-transparent md:hidden"
      >
        <div className={cx(wrap, 'flex h-16 items-center justify-between border-b border-(--fd-line)')}>
          <FlightDeckLogo />
          <button
            type="button"
            onClick={closeMenu}
            className={cx('inline-flex h-9 items-center gap-1 rounded-[2px] border border-(--fd-line-strong) px-3 text-[14px]/[20px]', focusRing)}
          >
            <RiCloseLine className="size-4" aria-hidden />
            Close
          </button>
        </div>
        <nav aria-label="Menu" className={cx(wrap, 'flex flex-col pt-4 pb-8')}>
          <ul className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <li key={link.href} className="border-b border-(--fd-line)">
                <a
                  href={link.href}
                  onClick={closeMenu}
                  className={cx('flex min-h-14 items-center text-[24px]/[30px] tracking-[-0.015em]', focusRing)}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-col gap-3">
            <Link href="/signup" className={cx(button.primary, 'w-full')}>
              Start planning
            </Link>
            <Link href="/login" className={cx(button.secondary, 'w-full')}>
              Sign in
            </Link>
          </div>
        </nav>
      </dialog>
    </header>
  );
}
