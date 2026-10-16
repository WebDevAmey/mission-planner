import { cx } from '@/utils/cx';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  message?: string;
}

const SIZE: Record<Required<LoadingSpinnerProps>['size'], string> = {
  small: 'size-4',
  medium: 'size-6',
  large: 'size-8',
};

/** Inline progress for a small region. Full pages use skeletons instead. */
export function LoadingSpinner({ size = 'medium', message }: LoadingSpinnerProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3">
      <span
        aria-hidden
        className={cx(
          'rounded-full border-2 border-separator-border border-t-text-secondary motion-safe:animate-spin',
          SIZE[size]
        )}
      />
      <span className={message ? 'text-body-2-regular text-text-secondary' : 'sr-only'}>{message ?? 'Loading'}</span>
    </div>
  );
}
