export default function HelpDeskTicketsLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        <div className="bg-muted h-4 w-64 animate-pulse rounded" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-border rounded-lg border p-4">
            <div className="bg-muted h-4 w-full animate-pulse rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
