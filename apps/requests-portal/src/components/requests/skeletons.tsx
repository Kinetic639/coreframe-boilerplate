import { Skeleton } from "@/components/ui/skeleton";

/** Placeholders shown while a server page streams in (loading.tsx). */
export function ListSkeleton() {
  return (
    <main
      aria-busy
      className="flex h-[calc(100dvh-3.5rem)] flex-col md:p-4 lg:h-auto lg:min-h-0 lg:flex-1"
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background md:rounded-lg md:border">
        <div className="flex items-center justify-between border-b px-3 py-2.5 md:px-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex h-10 items-center gap-4 border-b px-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-4 w-20" />
          ))}
        </div>
        <div className="flex h-10 items-center border-b px-3">
          <Skeleton className="h-6 w-24" />
        </div>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex h-[49px] items-center gap-6 border-b px-3">
            <div className="flex w-[260px] flex-col gap-1.5">
              <Skeleton className="h-3.5 w-3/4" />
              <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="hidden h-4 w-28 md:block" />
            <Skeleton className="hidden h-5 w-24 md:block" />
            <Skeleton className="hidden h-4 w-32 lg:block" />
          </div>
        ))}
      </div>
    </main>
  );
}

export function DetailSkeleton() {
  return (
    <div aria-busy className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b px-3 sm:px-4">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="ml-auto h-8 w-36" />
      </div>
      <div className="flex flex-col gap-4 px-4 py-5 sm:px-6">
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
