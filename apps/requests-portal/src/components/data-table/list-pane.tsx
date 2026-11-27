"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type MouseEvent, type ReactNode } from "react";
import { ListBulkBar } from "./bulk-bar";
import { downloadCsv, nodeText, rowsToCsv } from "./csv";
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
 * A data table list's body: the desktop table, the narrow list beside an
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
  cardHidden = [],
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
  selection: givenSelection,
  bulkBar,
  selectable = true,
  exportValue,
  exportName,
  bulkActions,
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
  /** Columns left out of the phone card's fields (shown by the badge or identity). */
  cardHidden?: readonly string[];
  actions?: (row: Row) => ReactNode;
  cellClassName?: (columnId: string) => string | undefined;
  /** title, loading, loadError, retry, countSuffix (other keys are ignored). */
  labels: Record<string, string>;
  empty: string;
  loading?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onRetry?: () => void;
  /** Opens a row beside the list (none: a row's link leads to its own page). */
  onPreview?: (key: string | null) => void;
  onPrefetch?: (key: string | null) => void;
  /**
   * The list's own ticking (with `bulkBar`). None: the pane ticks rows
   * itself and shows the shared bar (count, CSV export, untick).
   */
  selection?: TableSelection<Row>;
  /** The actions on the ticked rows, above the list (shown while any are ticked). */
  bulkBar?: ReactNode;
  /** false: no boxes at all. */
  selectable?: boolean;
  /** A cell's text in the CSV export (default: the text the cell draws). */
  exportValue?: (row: Row, columnId: string) => unknown;
  /** The exported file's name, before the date (default: the list's title). */
  exportName?: string;
  /** More actions on the ticked rows in the shared bar (e.g. archive). */
  bulkActions?: (rows: Row[], clear: () => void) => ReactNode;
}) {
  // The pane's own ticks (when the list keeps none): kept across pages, as
  // the rows themselves so the export needs no request.
  const tb = useTranslations("dataTable.bulk");
  const [ticked, setTicked] = useState<ReadonlyMap<string, Row>>(() => new Map());
  const own = selectable && !givenSelection;
  const tickedOnPage = own ? rows.filter((row) => ticked.has(rowKey(row))) : [];
  const clear = () => setTicked(new Map());
  const ownSelection: TableSelection<Row> | undefined = own
    ? {
        isSelected: (row) => ticked.has(rowKey(row)),
        toggle: (row) =>
          setTicked((current) => {
            const next = new Map(current);
            const key = rowKey(row);
            if (next.has(key)) next.delete(key);
            else next.set(key, row);
            return next;
          }),
        all: rows.length > 0 && tickedOnPage.length === rows.length,
        some: tickedOnPage.length > 0,
        toggleAll: () =>
          setTicked((current) => {
            const next = new Map(current);
            const every = rows.every((row) => next.has(rowKey(row)));
            for (const row of rows) {
              if (every) next.delete(rowKey(row));
              else next.set(rowKey(row), row);
            }
            return next;
          }),
        allLabel: labels.selectAll ?? tb("selectAll"),
        rowLabel: (row) => tb("selectRow", { label: nodeText(identity(row)) }),
      }
    : undefined;
  const selection = selectable ? (givenSelection ?? ownSelection) : undefined;
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const cardFields = shown.filter((id) => !cardHidden.includes(id));
  const { page, pages, range } = pageState({ page: askedPage, size }, totalCount, rows.length);
  const openPreview = (event: MouseEvent, row: Row) => {
    if (!onPreview) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    const key = rowKey(row);
    onPreview(selected === key ? null : key);
  };
  const linkProps = (row: Row) => ({
    href: rowHref(row),
    scroll: onPreview ? false : undefined,
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
  const message = (loading ? labels.loading : error ? labels.loadError : empty) ?? empty;
  return (
    <div
      className={cn(
        "dt-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        selected && "dt-list-pane--preview"
      )}
      aria-busy={loading || refreshing}
      data-refreshing={refreshing ? "" : undefined}
    >
      {/* The rows stay while new ones come: a thin bar says so, not a skeleton. */}
      {loading || refreshing ? (
        <div className="dt-list-progress" role="progressbar" aria-label={labels.loading} />
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
      {selected ? null : own ? (
        ticked.size ? (
          <ListBulkBar
            count={ticked.size}
            labels={labels}
            onClear={clear}
            onExport={() => {
              const tickedRows = [...ticked.values()];
              const columns = [
                { id: set.pinned.id, label: set.pinned.label },
                ...shown.map((id) => ({ id, label: set.labels[id] ?? id })),
              ];
              downloadCsv(
                rowsToCsv(tickedRows, columns, (row, id) =>
                  exportValue
                    ? exportValue(row, id)
                    : nodeText(id === set.pinned.id ? identity(row) : plainValue(row, id))
                ),
                exportName ?? fileName(labels.title, tb("fileName"))
              );
            }}
          >
            {bulkActions?.([...ticked.values()], clear)}
          </ListBulkBar>
        ) : null
      ) : (
        bulkBar
      )}
      {selected ? (
        <aside
          className="dt-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
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
        <div className="dt-list-desktop-table min-h-0 flex-1 flex-col">
          <DataTable
            caption={labels.title ?? ""}
            set={set}
            columns={shown.map((id) => ({ id, label: set.labels[id] ?? id, sort: sortOf(id) }))}
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
      <div className="dt-list-mobile min-h-0 flex-1 flex-col">
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
                  {cardFields.length ? (
                    <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                      {cardFields.map((id) => (
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

/** A file name from the list's title ("Zlecenia serwisowe" → "zlecenia-serwisowe"). */
function fileName(title: string | undefined, fallback: string) {
  const name = (title ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return name || fallback;
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
      className="dt-list-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-3xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
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
