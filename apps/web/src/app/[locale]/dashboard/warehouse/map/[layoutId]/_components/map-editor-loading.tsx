import { Skeleton } from "@/components/ui/skeleton";

export function MapEditorLoading() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-muted/30">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-background px-4">
        <Skeleton className="h-8 w-28 rounded-md" />
        <div className="h-5 w-px bg-border" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-5 w-20 rounded-full" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-8 w-36 rounded-md" />
          <div className="h-5 w-px bg-border" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="flex h-full w-56 shrink-0 flex-col overflow-hidden border-r bg-background">
          <div className="border-b bg-muted/50 px-3 py-2">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-2 border-b px-3 py-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-11/12" />
            <Skeleton className="h-6 w-10/12" />
          </div>
          <div className="border-b bg-muted/50 px-3 py-2">
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-3 gap-2 border-b p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-lg" />
            ))}
          </div>
          <div className="border-b bg-muted/50 px-3 py-2">
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="space-y-2 p-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
          </div>
        </aside>

        <main className="relative flex-1 overflow-hidden bg-zinc-200 dark:bg-zinc-900">
          <div className="absolute inset-6 rounded-xl border-2 border-dashed border-border/60 bg-background/70" />
          <div className="absolute left-3 top-3 flex flex-col gap-1">
            <Skeleton className="h-28 w-10 rounded-lg" />
          </div>
          <div className="absolute bottom-3 right-3">
            <Skeleton className="h-8 w-52 rounded-full" />
          </div>
        </main>

        <aside className="h-full w-72 shrink-0 overflow-hidden border-l bg-background">
          <div className="border-b bg-muted/50 px-4 py-3">
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-4 p-4">
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-32 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </aside>
      </div>
    </div>
  );
}
