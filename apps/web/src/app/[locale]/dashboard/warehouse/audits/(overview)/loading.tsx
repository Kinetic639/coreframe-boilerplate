import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches AuditsDashboardClient's actual layout (banner, 4 stat cards, then
 * a search bar + session list) instead of the generic DataView table
 * skeleton, which has a completely different shape (wide multi-column
 * table) and doesn't read as "this page is about to look like this."
 * No outer padding here — the dashboard shell already supplies it for
 * non-flush pages, same as the real page.
 */
export default function AuditsDashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Top banner */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-32 shrink-0 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm"
          >
            <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-14" />
              <Skeleton className="h-5 w-8" />
            </div>
          </div>
        ))}
      </div>

      {/* Search + session list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full rounded-md sm:w-64" />
        </div>

        <div className="divide-y divide-border">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 sm:p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Skeleton className="h-5 w-28 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                    <Skeleton className="h-5 w-20 rounded" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex min-w-[150px] flex-row items-center justify-between gap-2 md:flex-col md:items-end">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-1.5 w-28 rounded-full" />
                </div>
                <Skeleton className="h-8 w-28 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
