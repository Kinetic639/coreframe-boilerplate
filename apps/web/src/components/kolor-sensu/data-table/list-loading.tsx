import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import "./ambra-list.css";

export interface ListLoadingProps {
  /** Buttons on the right of the title bar (e.g. "Create", "Export"). */
  actions?: number;
  /** Columns after the pinned one. */
  columns?: number;
  /** Rows shown while loading. */
  rows?: number;
  /** A tick-box column on the left. */
  selectable?: boolean;
  /** Controls on the right of the filter row (e.g. "Group variants", "Views"). */
  extras?: number;
  /** Tabs between the title bar and the filter row (e.g. the help desk's queues). */
  tabs?: number;
  /** Something above the list, e.g. view tabs. */
  above?: React.ReactNode;
  className?: string;
}

// Widths that vary from row to row, so the skeleton does not read as a grid of bars.
const CELL_WIDTHS = ["70%", "45%", "60%", "35%", "55%", "40%", "65%"];
const ROW_WIDTHS = ["w-24", "w-32", "w-20", "w-28", "w-36", "w-24", "w-16", "w-28"];

/**
 * Loading skeleton of a Kolor Sensu list (products, movements, locations…):
 * one bordered card with the title bar, the filter row, the table (pinned
 * first column, tick boxes, row menu) and the pagination footer. Phones get
 * the card list the page shows there.
 */
export function ListLoading({
  actions = 1,
  columns = 5,
  rows = 12,
  selectable = false,
  extras = 0,
  tabs = 0,
  above,
  className,
}: ListLoadingProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)} aria-busy="true" aria-live="polite">
      <span className="sr-only">Ładowanie…</span>
      {above}
      <section className="ks-list-view flex min-w-0 flex-col overflow-hidden rounded-lg border bg-background">
        {/* Title bar: title, count, actions */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2.5 md:px-4">
          <div className="flex items-baseline gap-2">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3.5 w-6" />
          </div>
          <div className="flex items-center gap-2">
            {Array.from({ length: actions }).map((_, index) => (
              <Skeleton
                key={index}
                // On phones the main action keeps its label, two others become
                // icon buttons and the rest move into a menu.
                className={cn(
                  "h-8 rounded-md",
                  index === actions - 1
                    ? "w-24"
                    : index < 2
                      ? "w-9 md:w-28"
                      : "hidden w-28 md:block"
                )}
              />
            ))}
          </div>
        </div>

        {/* Tabs (queues) */}
        {tabs > 0 ? (
          <div className="flex h-10 shrink-0 items-center gap-5 overflow-hidden border-b px-4">
            {Array.from({ length: tabs }).map((_, index) => (
              <Skeleton key={index} className={cn("h-3 shrink-0", index % 2 ? "w-14" : "w-28")} />
            ))}
          </div>
        ) : null}

        {/* Filter row: filter and search buttons, extras on the right */}
        <div className="flex min-h-9 shrink-0 items-center gap-1.5 border-b px-2 py-1.5">
          <Skeleton className="size-7 rounded-[5px]" />
          <Skeleton className="size-7 rounded-[5px]" />
          {extras > 0 ? (
            <div className="ml-auto flex items-center gap-3 pr-1">
              {Array.from({ length: extras }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-20" />
              ))}
            </div>
          ) : null}
        </div>

        {/* Desktop: the table */}
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden md:flex">
          <div className="flex h-8 shrink-0 items-center border-b">
            <div className="flex h-full w-[230px] shrink-0 items-center gap-2.5 border-r px-3">
              {selectable ? <Skeleton className="size-3.5 rounded-[3px]" /> : null}
              <Skeleton className="h-2.5 w-14" />
            </div>
            {Array.from({ length: columns }).map((_, index) => (
              <div
                key={index}
                className="flex h-full flex-1 items-center border-r px-2 last:border-r-0"
              >
                <Skeleton className="h-2.5 w-12" />
              </div>
            ))}
            <div className="flex h-full w-10 shrink-0 items-center justify-center border-l">
              <Skeleton className="size-3.5 rounded-[3px]" />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: rows }).map((_, row) => (
              <div key={row} className="flex h-[49px] items-center border-b">
                <div className="flex h-full w-[230px] shrink-0 items-center gap-2.5 border-r px-3">
                  {selectable ? <Skeleton className="size-3.5 shrink-0 rounded-[3px]" /> : null}
                  <div className="min-w-0 space-y-1.5">
                    <Skeleton className={cn("h-3", ROW_WIDTHS[row % ROW_WIDTHS.length])} />
                    <Skeleton className="h-2.5 w-36" />
                  </div>
                </div>
                {Array.from({ length: columns }).map((_, column) => (
                  <div
                    key={column}
                    className="flex h-full flex-1 items-center border-r px-2 last:border-r-0"
                  >
                    <Skeleton
                      className="h-3"
                      style={{ width: CELL_WIDTHS[(row + column) % CELL_WIDTHS.length] }}
                    />
                  </div>
                ))}
                <div className="flex h-full w-10 shrink-0 items-center justify-center border-l">
                  <Skeleton className="h-3.5 w-1 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Phone: a count and sort row, then cards */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:hidden">
          <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {Array.from({ length: Math.min(rows, 6) }).map((_, row) => (
              <div key={row} className="space-y-2 border-b px-3 py-2.5">
                <Skeleton className={cn("h-3.5", ROW_WIDTHS[row % ROW_WIDTHS.length])} />
                <Skeleton className="h-2.5 w-40" />
                <div className="grid grid-cols-2 gap-x-2 gap-y-2 pt-1">
                  {Array.from({ length: 4 }).map((_, cell) => (
                    <div key={cell} className="space-y-1">
                      <Skeleton className="h-2 w-12" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pagination footer */}
        <div className="flex h-9 shrink-0 items-center justify-end gap-3 border-t px-3">
          <Skeleton className="hidden h-3 w-28 md:block" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-4 w-10" />
        </div>
      </section>
    </div>
  );
}
