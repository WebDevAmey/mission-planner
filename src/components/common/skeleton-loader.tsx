import { Skeleton } from '@/components/ui/skeleton';

export function SkeletonLoader() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </div>
  );
}
