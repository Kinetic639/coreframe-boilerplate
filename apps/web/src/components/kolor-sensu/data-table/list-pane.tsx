import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { TableLink as PageLink } from "./table-navigation";
import { DataTable, TablePagination, pageState, TD, type TableSelection } from "./data-table";
import { ColumnsMenu } from "./columns-menu";
import { defaultLayout, type ColumnLayout, type ColumnSet, type ColumnWidths } from "./columns";
import { cn } from "@/lib/utils";

export interface ListSort {
  href: string;
  direction: "asc" | "desc" | null;
}

/**
 * A Kolor Sensu list's body: the desktop table, the narrow list beside an
 * open record, and the phone cards, with the pagination under each. The page
 * owns the address; this only draws it: every link is one the page builds.
 */
export function ListPane<Row>({
  rows,
  totalCount,
  page: askedPage,
  size,
  sizes,
  selected,
  rowKey,
  rowHref,
  pageHref,
  sizeHref,
  set,
  layout,
  widths,
  cookie,
  onLayoutChange,
  sortOf,
  pinnedSort,
  identity,
  value,
  plainValue = value,
  badge,
  actions,
  cellClassName,
  labels,
  empty,
  loading = false,
  refreshing = false,
  error = null,
  onRetry,
  onPreview,
  onPrefetch,
  selection,
}: {
  rows: Row[];
  totalCount: number;
  page: number;
  size: number;
  sizes: readonly number[];
  /** The key of the record open beside the list. */
  selected: string | null;
  rowKey: (row: Row) => string;
  /** The row's link: opens it beside the list (or closes it when open). */
  rowHref: (row: Row) => string;
  pageHref: (page: number) => string;
  sizeHref: (size: number) => string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  onLayoutChange: (layout: ColumnLayout) => void;
  /** A column's sort link, for the columns the list sorts by. */
  sortOf: (columnId: string) => ListSort | undefined;
  pinnedSort?: ListSort;
  /** What the pinned column (and the narrow list) shows of a row. */
  identity: (row: Row) => ReactNode;
  value: (row: Row, columnId: string) => ReactNode;
  /** The value on a phone card, which is one link (no links inside). */
  plainValue?: (row: Row, columnId: string) => ReactNode;
  /** Shown at the top right of a phone card (e.g. the status). */
  badge?: (row: Row) => ReactNode;
  actions?: (row: Row) => ReactNode;
  cellClassName?: (columnId: string) => string | undefined;
  /** title, loading, loadError, retry, countSuffix (other keys are ignored). */
  labels: Record<string, string>;
  empty: string;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onPreview: (key: string | null) => void;
  onPrefetch?: (key: string | null) => void;
  /** Ticking rows, for actions on several at once (none: no boxes). */
  selection?: TableSelection<Row>;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState({ page: askedPage, size }, totalCount, rows.length);
  const openPreview = (event: MouseEvent, row: Row) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const key = rowKey(row);
    onPreview(selected === key ? null : key);
  };
  const linkProps = (row: Row) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
    onMouseEnter: () => onPrefetch?.(rowKey(row)),
    onMouseLeave: () => onPrefetch?.(null),
    onFocus: () => onPrefetch?.(rowKey(row)),
  });
  const menu = (
    <ColumnsMenu
      cookie={cookie}
      defaults={defaultLayout(set)}
      labels={set.labels}
      layout={layout}
      onChange={onLayoutChange}
      pinnedLabel={set.pinned.label}
    />
  );
  const pagination = (
    <TablePagination
      sizes={sizes.map((option) => ({
        size: option,
        current: size === option,
        href: sizeHref(option),
      }))}
      range={range}
      previousHref={page > 1 ? pageHref(page - 1) : null}
      nextHref={page < pages ? pageHref(page + 1) : null}
    />
  );
  const PinnedIcon =
    pinnedSort?.direction === "asc"
      ? ArrowUp
      : pinnedSort?.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const message = loading ? labels.loading : error ? labels.loadError : empty;
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        selected && "ks-list-pane--preview"
      )}
      aria-busy={loading || refreshing}
      data-refreshing={refreshing ? "" : undefined}
    >
      {/* The rows stay while new ones come: a thin bar says so, not a skeleton. */}
      {loading || refreshing ? (
        <div className="ks-list-progress" role="progressbar" aria-label={labels.loading} />
      ) : null}
      {error ? (
        <div role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {labels.loadError} <span className="block text-xs">{error}</span>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="underline">
              {labels.retry}
            </button>
          ) : null}
        </div>
      ) : null}
      {selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            {pinnedSort ? (
              <PageLink
                href={pinnedSort.href}
                scroll={false}
                className={cn(
                  "inline-flex items-center gap-1 rounded hover:text-foreground",
                  pinnedSort.direction && "text-foreground"
                )}
              >
                {set.pinned.label}
                <PinnedIcon
                  className={cn("size-3", !pinnedSort.direction && "opacity-40")}
                  aria-hidden="true"
                />
              </PageLink>
            ) : (
              set.pinned.label
            )}
          </header>
          <ul>
            {rows.map((row) => {
              const key = rowKey(row);
              const current = key === selected;
              return (
                <li key={key} data-row-id={key}>
                  <PageLink
                    {...linkProps(row)}
                    className={cn(
                      "group flex h-[49px] items-center gap-2.5 border-b px-3 py-1 hover:bg-muted/50",
                      current &&
                        "border-l-[3px] border-l-primary bg-primary/10 pl-[9px] hover:bg-primary/10"
                    )}
                    aria-current={current ? "true" : undefined}
                  >
                    {identity(row)}
                  </PageLink>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : (
        <div className="ks-list-desktop-table min-h-0 flex-1 flex-col">
          <DataTable
            caption={labels.title}
            set={set}
            columns={shown.map((id) => ({ id, label: set.labels[id], sort: sortOf(id) }))}
            rows={rows}
            rowKey={rowKey}
            rowHref={rowHref}
            selected={(row) => rowKey(row) === selected}
            pinnedSort={pinnedSort}
            onRowIntent={(row) => onPrefetch?.(row ? rowKey(row) : null)}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center gap-2.5 py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td key={id} className={cn(TD, cellClassName?.(id))}>
                {value(row, id)}
              </td>
            )}
            actions={actions}
            selection={selection}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={message}
            pagination={pagination}
          />
        </div>
      )}
      <div className="ks-list-mobile min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {totalCount} {labels.countSuffix}
          </span>
          <div className="flex items-center gap-2">
            {pinnedSort ? (
              <PageLink href={pinnedSort.href}>
                {set.pinned.label}{" "}
                {pinnedSort.direction === "asc" ? "↑" : pinnedSort.direction === "desc" ? "↓" : "↕"}
              </PageLink>
            ) : null}
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {rows.map((row) => (
            <li
              key={rowKey(row)}
              className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30"
            >
              {selection ? (
                <input
                  type="checkbox"
                  aria-label={selection.rowLabel(row)}
                  checked={selection.isSelected(row)}
                  onChange={() => selection.toggle(row)}
                  className="mr-3 mt-2 size-4 shrink-0 cursor-pointer accent-[var(--primary)]"
                />
              ) : null}
              <PageLink {...linkProps(row)} className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2.5">{identity(row)}</span>
                    {badge ? <span className="shrink-0">{badge(row)}</span> : null}
                  </span>
                  {shown.length ? (
                    <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                      {shown.map((id) => (
                        <span key={id} className="min-w-0 text-xs">
                          <span className="block text-[10px] text-muted-foreground">
                            {set.labels[id]}
                          </span>
                          <span className="block truncate">{plainValue(row, id)}</span>
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
              </PageLink>
              {actions ? <div className="ml-1 shrink-0">{actions(row)}</div> : null}
            </li>
          ))}
          {!rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{message}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}

/** The record's panel beside the list (a sheet on narrow screens). */
export function ListSidePanel({
  titleId,
  title,
  backLabel,
  closeLabel,
  onClose,
  actions,
  children,
}: {
  titleId: string;
  title: ReactNode;
  backLabel: string;
  closeLabel: string;
  onClose: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside
      aria-labelledby={titleId}
      className="ks-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-3xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={closeLabel}
        >
          <X className="size-4" />
          <span className="hidden sm:inline">{backLabel}</span>
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span id={titleId} className="min-w-0 truncate text-sm">
          {title}
        </span>
        {actions ? <div className="ml-auto flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
}
