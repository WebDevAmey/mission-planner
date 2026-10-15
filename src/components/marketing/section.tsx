import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

/** Shared marketing section shell: 16px phone gutter, 1200px max width. */
export function Section({
  id,
  className,
  children,
  labelledBy,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
  labelledBy?: string;
}) {
  return (
    <section id={id} aria-labelledby={labelledBy} className={cx('scroll-mt-20 px-4 py-20 sm:px-6 sm:py-24 lg:px-8', className)}>
      <div className="mx-auto w-full max-w-[1200px]">{children}</div>
    </section>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'center',
}: {
  id: string;
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  align?: 'center' | 'start';
}) {
  return (
    <div className={cx('flex max-w-2xl flex-col gap-3', align === 'center' ? 'mx-auto items-center text-center' : 'items-start')}>
      <p className="text-caption-1-semibold uppercase tracking-[0.12em] text-accent-400">{eyebrow}</p>
      <h2 id={id} className="text-title-1-semibold text-balance text-text-primary sm:text-display-4-semibold">
        {title}
      </h2>
      {description ? <p className="text-headline-regular text-pretty text-text-secondary">{description}</p> : null}
    </div>
  );
}
