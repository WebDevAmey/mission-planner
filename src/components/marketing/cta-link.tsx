import Link from 'next/link';
import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { buttonStyles } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';

type IconComponent = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

/**
 * BoardUI Button styling on a next/link, for client-side navigation from
 * marketing and auth pages (BoardUI's ButtonLink renders a plain <a>).
 */
export function CtaLink({
  variant = 'primary',
  size = 'medium',
  leadingIcon: Leading,
  trailingIcon: Trailing,
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Link>, 'children'> & {
  variant?: keyof typeof buttonStyles.variant;
  size?: keyof typeof buttonStyles.size;
  leadingIcon?: IconComponent;
  trailingIcon?: IconComponent;
  children: ReactNode;
}) {
  return (
    <Link
      {...props}
      className={cx(buttonStyles.base, buttonStyles.size[size], buttonStyles.variant[variant], className)}
    >
      {Leading ? <Leading className={buttonStyles.icon[size]} aria-hidden /> : null}
      <span className={buttonStyles.label[size]}>{children}</span>
      {Trailing ? <Trailing className={cx(buttonStyles.icon[size], 'rtl:rotate-180')} aria-hidden /> : null}
    </Link>
  );
}
