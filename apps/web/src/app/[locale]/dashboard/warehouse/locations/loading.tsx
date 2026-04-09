import { Skeleton } from "@/components/ui/skeleton";

function TreeRowSkeleton({
  depth = 0,
  showBadge = false,
}: {
  depth?: number;
  showBadge?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-2 rounded-md px-2 py-2"
      style={{ paddingLeft: `${depth * 20 + 8}px` }}
    >
      <Skeleton className="h-4 w-4 shrink-0" />
      <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
      <Skeleton className="h-4 flex-1 max-w-52" />
      <Skeleton className="h-3 w-12 shrink-0" />
      {showBadge && <Skeleton className="h-5 w-20 shrink-0 rounded-full" />}
      <div className="ml-auto flex items-center gap-1">
        <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
        <Skeleton className="h-7 w-7 shrink-0 rounded-md" />
      </div>
    </div>
  );
}

export default function WarehouseLocationsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      <div className="rounded-lg border">
        <div className="divide-y">
          <TreeRowSkeleton depth={0} showBadge />
          <TreeRowSkeleton depth={1} />
          <TreeRowSkeleton depth={2} />
          <TreeRowSkeleton depth={1} />
          <TreeRowSkeleton depth={0} showBadge />
          <TreeRowSkeleton depth={1} />
        </div>
      </div>
    </div>
  );
}
