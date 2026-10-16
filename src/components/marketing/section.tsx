import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';
import { grid, type } from './styles';

/**
 * Section heading on the page grid: the title hangs from column 1, the
 * supporting line sits in the right half on desktop. No eyebrow labels.
 */
export function SectionHeading({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx(grid, 'gap-y-4', className)}>
      <h2 id={id} className={cx(type.head, 'col-span-4 max-w-[16ch] text-text-primary sm:col-span-12 lg:col-span-6')}>
        {title}
      </h2>
      {children ? (
        <p className={cx(type.lead, 'col-span-4 max-w-[44ch] self-end text-text-secondary sm:col-span-10 lg:col-span-5 lg:col-start-8')}>
          {children}
        </p>
      ) : null}
    </div>
  );
}
