import Link from 'next/link';
import { cx } from '@/utils/cx';
import { FORMAT_EXTENSIONS } from './formats-strip';
import { FlightDeckLogo } from './logo';
import { focusRing, grid, type, wrap } from './styles';

const COLUMNS = [
  {
    title: 'Product',
    items: [
      { label: 'Capabilities', href: '/#capabilities' },
      { label: 'How it works', href: '/#how-it-works' },
      { label: 'Pre-flight checks', href: '/#checks' },
      { label: 'Limits', href: '/#limits' },
      { label: 'FAQ', href: '/#faq' },
    ],
  },
  {
    title: 'Account',
    items: [
      { label: 'Create an account', href: '/signup' },
      { label: 'Sign in', href: '/login' },
      { label: 'Reset password', href: '/forgot-password' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-(--fd-line) bg-(--fd-surface)">
      <div className={cx(wrap, 'pt-12 pb-8 lg:pt-16')}>
        <div className={cx(grid, 'gap-y-10')}>
          <div className="col-span-4 flex flex-col gap-3 sm:col-span-12 lg:col-span-5">
            <FlightDeckLogo />
            <p className={cx(type.body, 'max-w-[36ch] text-text-secondary')}>
              Mission planning for ArduPilot operators: survey, route, check, export.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title} className="col-span-2 flex flex-col gap-3 sm:col-span-4 lg:col-span-2">
              <h2 className={cx(type.small, 'font-medium text-text-primary')}>{col.title}</h2>
              <ul className="flex flex-col gap-2">
                {col.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className={cx(type.small, 'rounded-[2px] text-text-secondary transition-colors duration-[120ms] hover:text-text-primary', focusRing)}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className="col-span-4 flex flex-col gap-3 sm:col-span-4 lg:col-span-3">
            <h2 className={cx(type.small, 'font-medium text-text-primary')}>Formats</h2>
            <ul className={cx(type.data, 'flex flex-wrap gap-x-3 gap-y-1 text-text-secondary')}>
              {FORMAT_EXTENSIONS.map((ext) => (
                <li key={ext}>{ext}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className={cx(type.data, 'mt-12 flex flex-col gap-2 border-t border-(--fd-line) pt-6 text-[12px]/[16px] text-text-tertiary lg:flex-row lg:justify-between')}>
          <p>© {new Date().getFullYear()} Flight Deck. Follow local aviation rules and keep the aircraft in sight.</p>
          <p>ArduPilot, Mission Planner and QGroundControl are trademarks of their owners.</p>
        </div>
      </div>
    </footer>
  );
}
