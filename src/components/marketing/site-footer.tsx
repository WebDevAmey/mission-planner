import Link from 'next/link';
import { FlightDeckLogo } from './logo';

const LINKS = [
  {
    title: 'Product',
    items: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Features', href: '#features' },
      { label: 'Safety', href: '#safety' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Create account', href: '/signup' },
      { label: 'Sign in', href: '/login' },
      { label: 'Reset password', href: '/forgot-password' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-separator-border px-4 pt-12 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10">
        <div className="flex flex-col justify-between gap-10 sm:flex-row">
          <div className="flex max-w-xs flex-col gap-3">
            <FlightDeckLogo />
            <p className="text-body-regular text-text-secondary">
              Mission planning for ArduPilot operators: survey, route, check, export.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-10 sm:gap-16">
            {LINKS.map((group) => (
              <nav key={group.title} aria-label={group.title} className="flex flex-col gap-3">
                <p className="text-caption-1-semibold uppercase tracking-[0.12em] text-text-tertiary">{group.title}</p>
                <ul className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="text-body-regular text-text-secondary transition-colors hover:text-text-primary">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-separator-border pt-6 text-caption-1-regular text-text-tertiary sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Flight Deck. Always follow local aviation rules and fly within line of sight.</p>
          <p>ArduPilot, Mission Planner and QGroundControl are trademarks of their respective owners.</p>
        </div>
      </div>
    </footer>
  );
}
