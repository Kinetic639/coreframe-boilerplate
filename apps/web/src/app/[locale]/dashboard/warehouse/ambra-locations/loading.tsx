export default function AmbraLocationsLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 bg-background text-foreground">
      <div className="w-[360px] shrink-0 overflow-hidden border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <div className="h-9 rounded-xl bg-muted" />
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 12 }).map((_, index) => (
            <div
              key={index}
              className="h-8 rounded-lg bg-muted/70"
              style={{ marginLeft: `${Math.min(index % 4, 3) * 16}px` }}
            />
          ))}
        </div>
      </div>
      <div className="min-w-0 flex-1 overflow-hidden bg-background">
        <div className="border-b border-border bg-card p-5">
          <div className="h-8 w-80 rounded-xl bg-muted" />
          <div className="mt-3 h-4 w-56 rounded bg-muted/70" />
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-44 rounded-lg border border-border bg-card/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
