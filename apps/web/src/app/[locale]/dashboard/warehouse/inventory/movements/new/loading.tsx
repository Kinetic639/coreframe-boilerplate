import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background text-foreground">
      {/* Action Bar */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-20 rounded-sm" />
          <div className="h-5 w-px bg-border hidden sm:block" />
          <Skeleton className="h-5 w-36 rounded-sm" />
          <Skeleton className="h-5 w-12 rounded-sm" />
          <Skeleton className="h-5 w-10 rounded-sm" />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="hidden md:block h-8 w-32 rounded-sm" />
          <Skeleton className="h-8 w-24 rounded-sm" />
          <Skeleton className="h-8 w-28 rounded-sm" />
        </div>
      </header>

      {/* Validation Strip */}
      <div className="shrink-0 px-4 py-2.5 border-b bg-muted/30">
        <Skeleton className="h-4 w-64 rounded-sm" />
      </div>

      {/* Tab Navigation */}
      <div className="shrink-0 border-b px-4">
        <div className="flex gap-0 max-w-5xl mx-auto">
          <div className="py-2.5 px-4 flex items-center gap-2 border-b-2 border-primary">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-32 rounded-sm" />
          </div>
          <div className="py-2.5 px-4 flex items-center gap-2 border-b-2 border-transparent">
            <Skeleton className="h-4 w-4 rounded-sm" />
            <Skeleton className="h-4 w-20 rounded-sm" />
            <Skeleton className="h-5 w-5 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl w-full mx-auto px-4 py-4 space-y-4">
          {/* Movement Type Section */}
          <section className="rounded-sm border bg-card p-4">
            <div className="flex items-center justify-between border-b pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-sm" />
                <Skeleton className="h-3 w-28 rounded-sm" />
              </div>
              <Skeleton className="h-3 w-24 rounded-sm" />
            </div>
            <Skeleton className="h-8 w-full rounded-md" />
          </section>

          {/* Document Details Section */}
          <section className="rounded-sm border bg-card p-4">
            <Skeleton className="h-3 w-36 rounded-sm mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-28 rounded-sm mb-1" />
                  <Skeleton className="h-9 w-full rounded-sm" />
                </div>
              ))}
            </div>
          </section>

          {/* Warehouse Routing Section */}
          <section className="rounded-sm border border-dashed bg-muted/30 p-4">
            <Skeleton className="h-3 w-36 rounded-sm mb-3" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Skeleton className="h-3 w-40 rounded-sm mb-1" />
                <Skeleton className="h-9 w-full rounded-sm" />
              </div>
              <div>
                <Skeleton className="h-3 w-44 rounded-sm mb-1" />
                <Skeleton className="h-9 w-full rounded-sm" />
              </div>
            </div>
          </section>

          {/* Notes Section */}
          <section className="rounded-sm border bg-card p-4">
            <Skeleton className="h-3 w-32 rounded-sm mb-2" />
            <Skeleton className="h-20 w-full rounded-sm" />
          </section>
        </div>
      </main>
    </div>
  );
}
