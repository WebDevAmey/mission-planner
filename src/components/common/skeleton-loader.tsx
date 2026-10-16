import { cx } from '@/utils/cx';

/** A single skeleton block in the inset tone. Pulses gently; static under reduced motion. */
export function SkeletonBlock({ className }: { className?: string }) {
  return <div aria-hidden className={cx('rounded-sm bg-background-secondary-default motion-safe:animate-pulse', className)} />;
}

export function SkeletonLoader() {
  return (
    <div className="flex flex-col gap-4" aria-hidden>
      <SkeletonBlock className="h-32 rounded-md" />
      <div className="flex flex-col gap-2">
        <SkeletonBlock className="h-4 w-3/4" />
        <SkeletonBlock className="h-4 w-1/2" />
        <SkeletonBlock className="h-4 w-5/6" />
      </div>
    </div>
  );
}
