import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

/**
 * Loading skeleton for /dashboard/tools/[slug].
 * Mirrors the disabled-tool preview layout (back button + header + separator).
 */
export default function ToolDetailLoading() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Back button stub */}
      <Skeleton className="h-8 w-28" />

      {/* Header row: title/description/badges left, Enable button right */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-9 w-24 shrink-0" />
      </div>

      <Separator />

      {/* Hint text */}
      <Skeleton className="h-4 w-64" />
    </div>
  );
}
