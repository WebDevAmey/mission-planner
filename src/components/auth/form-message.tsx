import { RiCheckboxCircleLine, RiErrorWarningLine, RiInformationLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

const VARIANTS = {
  error: { icon: RiErrorWarningLine, className: 'bg-status-rose-background text-status-rose-text' },
  success: { icon: RiCheckboxCircleLine, className: 'bg-status-lime-background text-status-lime-text' },
  info: { icon: RiInformationLine, className: 'bg-status-yellow-background text-status-yellow-text' },
} as const;

export function FormMessage({
  variant,
  children,
  className,
}: {
  variant: keyof typeof VARIANTS;
  children: ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: tone } = VARIANTS[variant];
  return (
    <div
      className={cx('mb-4 flex items-start gap-2 rounded-2lg px-3 py-2.5 text-body-2-regular', tone, className)}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
