import { Skeleton } from "@/components/ui/skeleton";

export default function HelpDeskSettingsLoading() {
  return (
    <div className="flex flex-col gap-8 p-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      <Skeleton className="h-px w-full" />
      <div className="space-y-4">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-8 flex-1 rounded-md" />
            <Skeleton className="h-8 w-32 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}
