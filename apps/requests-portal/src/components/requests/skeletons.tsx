import { Skeleton } from "@/components/ui/skeleton";

/** Placeholders shown while a server page streams in (loading.tsx). */
export function ListSkeleton() {
  return (
    <div aria-busy className="flex flex-1 flex-col lg:p-6">
      <div className="flex flex-1 flex-col bg-card lg:rounded-lg lg:border lg:shadow-sm">
        <div className="hidden items-center justify-between border-b px-6 py-4 lg:flex">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="flex flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:px-6">
          <Skeleton className="h-10 w-full lg:w-48" />
          <Skeleton className="h-10 w-full lg:w-96" />
        </div>
        <div className="flex flex-col gap-3 p-4 lg:gap-0 lg:p-0">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border p-4 lg:flex-row lg:items-center lg:gap-6 lg:rounded-none lg:border-0 lg:border-b lg:px-6"
            >
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <Skeleton className="h-6 w-28 rounded-full" />
              <Skeleton className="hidden h-4 w-24 lg:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy className="flex flex-col bg-background lg:bg-transparent">
      <div className="flex h-14 items-center gap-3 border-b px-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-col gap-4 px-4 py-5 lg:px-6">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-6 w-3/4" />
        <div className="flex flex-wrap gap-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-6 w-28" />
            </div>
          ))}
        </div>
        <Skeleton className="mt-2 h-10 w-full" />
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-16 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}
