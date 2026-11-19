import { Skeleton } from "@/components/ui/skeleton";

// Shown at once while the board renders on the server: the header and a few
// columns of cards in the board's shape, so nothing jumps when it arrives.
const COLUMNS = [4, 3, 5, 2];

export default function PlanningBoardsLoading() {
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true">
      <div className="flex items-center gap-3 border-b py-3 pl-3 pr-5">
        <Skeleton className="h-7 w-7 rounded-md" />
        <Skeleton className="h-6 w-48" />
        <div className="ml-auto flex -space-x-1.5">
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-7 w-7 rounded-full border-2 border-background" />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden p-4">
        {COLUMNS.map((cards, column) => (
          <div
            key={column}
            className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2"
          >
            <Skeleton className="mb-1 h-5 w-32" />
            {Array.from({ length: cards }, (_, card) => (
              <Skeleton key={card} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
