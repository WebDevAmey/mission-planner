import { RiCheckboxCircleLine, RiErrorWarningLine, RiInformationLine } from '@remixicon/react';
import type { ReactNode } from 'react';
import { cx } from '@/utils/cx';

const VARIANTS = {
  error: { icon: RiErrorWarningLine, className: 'border-fd-danger/30 bg-fd-danger-tint text-fd-danger' },
  success: { icon: RiCheckboxCircleLine, className: 'border-fd-ok/30 bg-fd-ok-tint text-fd-ok' },
  info: { icon: RiInformationLine, className: 'border-fd-info/30 bg-fd-info-tint text-fd-info' },
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
      className={cx('mb-4 flex items-start gap-2 rounded-fd-control border px-3 py-2.5 text-[14px]/[20px]', tone, className)}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 text-text-primary">{children}</div>
    </div>
  );
}
