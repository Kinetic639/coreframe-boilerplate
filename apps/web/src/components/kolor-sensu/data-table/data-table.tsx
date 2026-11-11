import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/utils";
import { PageLink as Link } from "../public-site/page-link";
import { ColumnResizer } from "./column-resizer";
import { usualWidth, widthOf, type ColumnSet, type ColumnWidths } from "./columns";
import { TableRow } from "./table-row";

// A table of the portals (bookings, clients), rendered on the server: one
// page of rows the database searched, filtered and sorted, dense as a
// spreadsheet (a line a row, thin grid lines). The first column (the row's
// name or number) stays pinned left and the row's menu right when it
// scrolls sideways; the columns in between are the person's own choice,
// order and widths. Headers sort, the footer pages; the state is the
// address. A click on a row opens it in the side panel.

export const ACTIONS_WIDTH = 40;

// Pinned cells keep their own background (following the row's state) and
// a line where the rest scrolls under them.
export const PIN_LEFT = "sticky left-0 z-10 shadow-[inset_-1px_0_0_var(--border)]";
export const PIN_RIGHT = "sticky right-0 z-10 shadow-[inset_1px_0_0_var(--border)]";
export const PIN_BG =
  "bg-[var(--surface)] group-hover:bg-[var(--surface-subtle)] group-data-[selected]:bg-[var(--primary-soft)]";

export const TH =
  "sticky top-0 z-20 h-8 overflow-hidden border-r border-b border-[var(--border)] bg-[var(--surface)] px-2 text-left text-[0.75rem] font-medium text-ellipsis whitespace-nowrap text-[var(--text-muted)] last:border-r-0";
/** A body cell: 30 px, a line right and below, the text cut at its end. */
export const TD =
  "h-[30px] overflow-hidden border-r border-b border-[var(--border)] px-2 align-middle text-ellipsis whitespace-nowrap last:border-r-0";

export interface SortState {
  /** Where a click leads (the next of: its way, the other, none). */
  href: string;
  /** How the table is sorted by this column now (null: not by it). */
  direction: "asc" | "desc" | null;
}

/** A column's header: its name, a sort link if it sorts, its edge. */
export function SortHead({
  label,
  sort,
  resizer,
  className,
}: {
  label: string;
  sort?: SortState;
  /** The edge that sets the column's width, if widths are kept. */
  resizer?: ReactNode;
  className?: string;
}) {
  if (!sort) {
    return (
      <th className={cn(TH, className)} scope="col">
        {label}
        {resizer}
      </th>
    );
  }
  const sorted = sort.direction;
  const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ChevronsUpDown;
  return (
    <th
      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
      className={cn(TH, className)}
      scope="col"
    >
      <Link
        className={cn(
          "inline-flex items-center gap-1 rounded hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
          sorted && "text-[var(--text)]"
        )}
        href={sort.href}
        scroll={false}
      >
        {label}
        <Icon aria-hidden="true" className={cn("size-3", !sorted && "opacity-40")} />
      </Link>
      {resizer}
    </th>
  );
}

/** Which page this is, of how many, and `11–14 z 42`. */
export function pageState(
  { page: asked, size }: { page: number; size: number },
  total: number,
  shown: number
) {
  const pages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(Math.max(1, asked), pages);
  const first = total ? (page - 1) * size + 1 : 0;
  return {
    pages,
    page,
    range: total ? `${first}–${first + Math.max(shown, 1) - 1} z ${total}` : "0 z 0",
  };
}

/**
 * The table's footer, on the right: rows per page, where in the list this
 * is and the way to the others.
 */
export function TablePagination({
  sizes,
  range,
  previousHref,
  nextHref,
}: {
  /** Each choice of rows per page and its link. */
  sizes: { size: number; href: string; current: boolean }[];
  /** `11–14 z 42` */
  range: string;
  /** None: the first (or the last) page. */
  previousHref: string | null;
  nextHref: string | null;
}) {
  const step = (href: string | null, label: string, icon: ReactNode) =>
    href ? (
      <Link
        aria-label={label}
        className="inline-grid size-6 place-items-center rounded-[4px] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
        href={href}
        scroll={false}
      >
        {icon}
      </Link>
    ) : (
      <span
        aria-disabled="true"
        aria-label={label}
        className="inline-grid size-6 place-items-center opacity-35"
        role="link"
      >
        {icon}
      </span>
    );
  return (
    <div className="flex h-8 shrink-0 items-center gap-1 border-t border-[var(--border)] px-2 text-[0.75rem] text-[var(--text-muted)] tabular-nums">
      <div className="ml-auto flex items-center gap-3">
        <nav aria-label="Wierszy na stronie" className="flex items-center gap-0.5">
          <span className="mr-1">Wierszy:</span>
          {sizes.map((option) => (
            <Link
              aria-current={option.current ? "true" : undefined}
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-[4px] px-1 font-medium focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none",
                option.current
                  ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "hover:bg-[var(--surface-subtle)] hover:text-[var(--text)]"
              )}
              href={option.href}
              key={option.size}
              scroll={false}
            >
              {option.size}
            </Link>
          ))}
        </nav>
        <span aria-hidden="true" className="h-4 w-px bg-[var(--border)]" />
        <nav aria-label="Strony" className="flex items-center gap-0.5">
          <span aria-live="polite" className="mr-1.5">
            {range}
          </span>
          {step(
            previousHref,
            "Poprzednia strona",
            <ChevronLeft aria-hidden="true" className="size-3.5" />
          )}
          {step(
            nextHref,
            "Następna strona",
            <ChevronRight aria-hidden="true" className="size-3.5" />
          )}
        </nav>
      </div>
    </div>
  );
}

export interface DataColumn {
  id: string;
  label: string;
  /** It sorts: the link and the state (none: it does not sort). */
  sort?: SortState;
}

export interface DataTableProps<Row> {
  caption: string;
  /** The bar above: the view, the search and the filters. */
  toolbar?: ReactNode;
  /** The table's columns (names, usual widths, the pinned one). */
  set: ColumnSet<string>;
  /** The columns shown, in their order. */
  columns: DataColumn[];
  rows: Row[];
  rowKey: (row: Row) => string;
  /** Where a click on the row leads (its panel; open: closes it). */
  rowHref: (row: Row) => string;
  selected: (row: Row) => boolean;
  /** The pinned first column sorts: its link and state. */
  pinnedSort?: SortState;
  /** The pinned first cell's content (the row's name or number). */
  pinned: (row: Row, href: string, selected: boolean) => ReactNode;
  /** A body cell, a whole <td> (with TD's classes). */
  cell: (row: Row, column: string) => ReactNode;
  /** The row's "⋮" menu. */
  actions?: (row: Row) => ReactNode;
  /** In the last column's header (the "Kolumny" menu). */
  menu?: ReactNode;
  /** The person's widths, and where they are kept (none: fixed). */
  widths?: ColumnWidths;
  widthsCookie?: string;
  /** What an empty page says. */
  empty: string;
  /** The footer (TablePagination). */
  pagination: ReactNode;
}

export function DataTable<Row>({
  caption,
  toolbar,
  set,
  columns,
  rows,
  rowKey,
  rowHref,
  selected,
  pinned,
  pinnedSort,
  cell,
  actions,
  menu,
  widths = {},
  widthsCookie,
  empty,
  pagination,
}: DataTableProps<Row>) {
  const pin = set.pinned.id;
  // Fixed widths, the columns' own; a last empty column takes what is
  // left of a wide screen, so each column stays as wide as it was set.
  const minWidth =
    widthOf(set, pin, widths) +
    ACTIONS_WIDTH +
    columns.reduce((sum, column) => sum + widthOf(set, column.id, widths), 0);
  const resizer = (id: string, label: string) =>
    widthsCookie ? (
      <ColumnResizer
        column={id}
        cookie={widthsCookie}
        label={label}
        usualWidth={usualWidth(set, id)}
        width={widthOf(set, id, widths)}
      />
    ) : null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--surface)]">
      {toolbar}
      <div className="min-h-0 flex-1 overflow-auto">
        <table
          className="w-full table-fixed border-separate border-spacing-0 text-[0.8125rem] leading-5 text-[var(--text)]"
          style={{ minWidth }}
        >
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            <col data-column={pin} data-width="" style={{ width: widthOf(set, pin, widths) }} />
            {columns.map((column) => (
              <col
                data-column={column.id}
                data-width=""
                key={column.id}
                style={{ width: widthOf(set, column.id, widths) }}
              />
            ))}
            <col />
            <col data-width="" style={{ width: ACTIONS_WIDTH }} />
          </colgroup>
          <thead>
            <tr>
              <SortHead
                className={cn(PIN_LEFT, "z-30 pl-3")}
                label={set.pinned.label}
                resizer={resizer(pin, set.pinned.label)}
                sort={pinnedSort}
              />
              {columns.map((column) => (
                <SortHead
                  key={column.id}
                  label={column.label}
                  resizer={resizer(column.id, column.label)}
                  sort={column.sort}
                />
              ))}
              <th aria-hidden="true" className={cn(TH, "px-0")} />
              <th className={cn(TH, PIN_RIGHT, "z-30 w-10 px-1 text-center")} scope="col">
                {menu ?? <span className="sr-only">Akcje</span>}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  className="px-3 py-10 text-center text-sm text-[var(--text-muted)]"
                  colSpan={columns.length + 3}
                >
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const isSelected = selected(row);
                const href = rowHref(row);
                return (
                  <TableRow href={href} key={rowKey(row)} selected={isSelected}>
                    <th
                      className={cn(TD, PIN_LEFT, PIN_BG, "pl-3 text-left font-medium")}
                      scope="row"
                    >
                      {pinned(row, href, isSelected)}
                    </th>
                    {columns.map((column) => cell(row, column.id))}
                    <td aria-hidden="true" className={cn(TD, "px-0")} />
                    <td className={cn(TD, PIN_RIGHT, PIN_BG, "w-10 px-1 text-center")}>
                      {actions?.(row)}
                    </td>
                  </TableRow>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {pagination}
    </div>
  );
}
