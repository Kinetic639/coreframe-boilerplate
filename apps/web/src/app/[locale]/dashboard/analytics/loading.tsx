export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-4 w-80 animate-pulse rounded" />
      </div>
    </div>
  );
}
