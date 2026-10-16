import { RiCheckLine, RiCloseLine } from '@remixicon/react';
import { cx } from '@/utils/cx';

export function PasswordRule({ met, minLength }: { met: boolean; minLength: number }) {
  const Icon = met ? RiCheckLine : RiCloseLine;
  return (
    <p className={cx('flex items-center gap-1.5 text-[13px]/[18px]', met ? 'text-fd-ok' : 'text-text-tertiary')}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      At least {minLength} characters
    </p>
  );
}
