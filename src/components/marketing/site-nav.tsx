'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { RiArrowRightLine, RiCloseLine, RiMenuLine } from '@remixicon/react';
import { IconButton } from '@/components/base/buttons/icon-button';
import { cx } from '@/utils/cx';
import { CtaLink } from './cta-link';
import { FlightDeckLogo } from './logo';

const NAV_LINKS = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Features', href: '#features' },
  { label: 'Safety', href: '#safety' },
  { label: 'FAQ', href: '#faq' },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header
      className={cx(
        'sticky top-0 z-40 border-b transition-[background-color,border-color] duration-200',
        scrolled || open
          ? 'border-separator-border bg-background-full/85 backdrop-blur-md'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Flight Deck home" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
          <FlightDeckLogo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-body-medium text-text-secondary transition-colors hover:bg-background-primary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring focus-visible:outline-none"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <CtaLink href="/login" variant="ghost" size="small" className="hidden sm:inline-flex">
            Sign in
          </CtaLink>
          <CtaLink href="/signup" size="small" trailingIcon={RiArrowRightLine}>
            Get started
          </CtaLink>
          <IconButton
            icon={open ? RiCloseLine : RiMenuLine}
            size="small"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden"
          />
        </div>
      </div>

      {open ? (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-separator-border px-4 pb-4 md:hidden">
          <ul className="flex flex-col py-2">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-11 items-center rounded-lg px-2 text-headline-medium text-text-primary hover:bg-background-primary-hover"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <CtaLink href="/login" variant="secondary" className="w-full">
            Sign in
          </CtaLink>
        </nav>
      ) : null}
    </header>
  );
}
