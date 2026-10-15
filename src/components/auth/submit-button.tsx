import { RiArrowRightLine, RiLoader4Line } from '@remixicon/react';
import type { ReactNode } from 'react';
import { Button } from '@/components/base/buttons/button';

function Spinner({ className }: { className?: string }) {
  return <RiLoader4Line className={`${className ?? ''} animate-spin motion-reduce:animate-none`} aria-hidden />;
}

/** Full-width primary BoardUI button with a pending state. */
export function SubmitButton({ loading, disabled, children }: { loading: boolean; disabled: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      variant="primary"
      disabled={disabled}
      aria-busy={loading || undefined}
      trailingIcon={loading ? Spinner : RiArrowRightLine}
      className="w-full"
    >
      {children}
    </Button>
  );
}
