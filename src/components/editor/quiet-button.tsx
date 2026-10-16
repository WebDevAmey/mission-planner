'use client';

import type { RemixiconComponentType } from '@remixicon/react';
import { Button as AriaButton, type ButtonProps } from 'react-aria-components';
import { cx } from '@/utils/cx';
import { FOCUS_RING_INSET } from './editor-styles';

/** Neutral text button for low-emphasis actions (Cancel, Details, Clear, Close).
 * Replaces BoardUI's ghost variant, whose accent tint would add orange to the view. */
export function QuietButton({
  size = 'small',
  icon: Icon,
  iconOnly,
  className,
  children,
  ...props
}: Omit<ButtonProps, 'className' | 'children'> & {
  size?: 'xs' | 'small';
  icon?: RemixiconComponentType;
  iconOnly?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <AriaButton
      {...props}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-md text-text-secondary transition-colors duration-[120ms]',
        'hover:bg-background-primary-hover hover:text-text-primary data-[pressed]:bg-background-primary-active',
        'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
        size === 'xs' ? 'h-6 px-1.5 text-[12px]' : 'h-8 px-2 text-[13px]',
        iconOnly && (size === 'xs' ? 'w-6 px-0' : 'w-8 px-0'),
        FOCUS_RING_INSET,
        className
      )}
    >
      {Icon && <Icon className={size === 'xs' ? 'size-3.5' : 'size-4'} aria-hidden />}
      {children}
    </AriaButton>
  );
}
