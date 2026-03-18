import { LoadingSkeleton } from "@/components/v2/feedback/loading-skeleton";

export default function ToolsLoading() {
  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <LoadingSkeleton variant="text" count={1} className="h-8 w-48" />
        <LoadingSkeleton variant="text" count={1} className="h-4 w-72" />
      </div>
      <LoadingSkeleton variant="card" count={6} />
    </div>
  );
}
