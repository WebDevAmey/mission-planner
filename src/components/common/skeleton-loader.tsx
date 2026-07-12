export function SkeletonLoader() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-32 bg-gray-800 rounded-lg" />
      <div className="space-y-2">
        <div className="h-4 bg-gray-800 rounded w-3/4" />
        <div className="h-4 bg-gray-800 rounded w-1/2" />
        <div className="h-4 bg-gray-800 rounded w-5/6" />
      </div>
    </div>
  );
}