import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shared loading skeleton for the full-bleed mobile audit step screens
 * (wizard, guided-count, review, report). These screens opt into
 * flushContent once their client component mounts, but loading.tsx renders
 * before that happens, so this still sits inside the dashboard shell's
 * default padding — intentional, it's a brief flash, not worth chasing
 * pixel-perfect alignment with the flush layout for. Mirrors their common
 * shape (a sticky top bar, then a single centered mx-auto max-w-md content
 * column) instead of the generic wide DataView table skeleton.
 */
export function AuditStepLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 shadow-sm">
        <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
        <Skeleton className="h-4 flex-1 rounded" />
        <Skeleton className="h-7 w-7 shrink-0 rounded-lg" />
      </div>

      <div className="mx-auto max-w-md space-y-4">
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-md">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-5/6" />
        </div>
        <div className="space-y-3 rounded-xl border border-border bg-card p-5 shadow-md">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </div>
    </div>
  );
}
