import { Skeleton } from "@/components/ui/skeleton";

interface DataViewLoadingProps {
  /** Number of skeleton table rows */
  rows?: number;
  /** Number of skeleton columns */
  columns?: number;
  /** Show a "New …" button skeleton on the right of the header */
  showActionButton?: boolean;
}

/**
 * Loading skeleton that matches the standard DataView page layout:
 * header (title + subtitle + optional action button) → filter bar → table.
 */
export function DataViewLoading({
  rows = 8,
  columns = 5,
  showActionButton = true,
}: DataViewLoadingProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        {showActionButton && <Skeleton className="h-8 w-28 rounded-md" />}
      </div>

      {/* DataView container */}
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border bg-background">
        {/* Toolbar row: search + filter pills */}
        <div className="flex items-center gap-2 border-b px-4 py-2.5">
          <Skeleton className="h-7 w-48 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-md" />
            <Skeleton className="h-7 w-7 rounded-md" />
          </div>
        </div>

        {/* Table header */}
        <div
          className="grid border-b px-4"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="py-3 pr-4">
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        {/* Table rows */}
        <div className="divide-y">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid items-center px-4"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {Array.from({ length: columns }).map((__, colIdx) => (
                <div key={colIdx} className="py-4 pr-4">
                  <Skeleton
                    className="h-4"
                    style={{ width: colIdx === 0 ? "60%" : colIdx % 3 === 0 ? "40%" : "70%" }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
