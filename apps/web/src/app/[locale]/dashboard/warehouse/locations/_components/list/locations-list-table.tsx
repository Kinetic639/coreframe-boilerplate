"use client";

import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronsUpDown,
  ClipboardCheck,
  Eye,
  Printer,
  TreePine,
} from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { TableLink as PageLink } from "@/components/kolor-sensu/data-table/table-navigation";
import {
  DataTable,
  TablePagination,
  pageState,
  TD,
  type TableSelection,
} from "@/components/kolor-sensu/data-table/data-table";
import { ColumnsMenu } from "@/components/kolor-sensu/data-table/columns-menu";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { RowActionButton, RowActionLink, RowActions } from "@/components/kolor-sensu/row-actions";
import { cn } from "@/lib/utils";
import {
  LOCATION_PAGE_SIZES,
  locationHref,
  type LocationListRow,
  type LocationSort,
  type LocationState,
} from "./locations-list-state";

/** Columns the list sorts by (each the location's own field). */
const SORT_FIELD: Record<string, LocationSort> = {
  path: "struktura",
  level: "level",
  created_at: "created_at",
};

export interface LocationRowCommands {
  /** The tree view, with this location open. */
  showInTree: (id: string) => void;
  print: (ids: string[]) => void;
  audit: (ids: string[]) => void;
}

export function LocationsListTable({
  rows,
  totalCount,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  ticked,
  onTickedChange,
  commands,
  onLayoutChange,
  onPreview,
}: {
  rows: LocationListRow[];
  totalCount: number;
  state: LocationState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  /** The rows ticked (ids), for actions on several at once. */
  ticked: string[];
  onTickedChange: (ids: string[]) => void;
  commands: LocationRowCommands;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (id: string | null) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    totalCount,
    rows.length
  );
  const href = (patch: Partial<LocationState>) => locationHref(path, state, patch);
  const rowHref = (row: LocationListRow) =>
    href({ selected: state.selected === row.id ? null : row.id });
  const openPreview = (event: MouseEvent, row: LocationListRow) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.id ? null : row.id);
  };
  const sortOf = (field: LocationSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
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
  const actions = (row: LocationListRow) => (
    <RowActions label={row.code ?? row.name}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionButton
        onSelect={() => commands.showInTree(row.id)}
        icon={<TreePine className="size-4" />}
      >
        {labels.showInTree}
      </RowActionButton>
      <RowActionButton
        onSelect={() => commands.print([row.id])}
        icon={<Printer className="size-4" />}
      >
        {labels.printLabel}
      </RowActionButton>
      <RowActionButton
        onSelect={() => commands.audit([row.id])}
        icon={<ClipboardCheck className="size-4" />}
      >
        {labels.auditLocation}
      </RowActionButton>
    </RowActions>
  );
  const value = (row: LocationListRow, id: string): ReactNode => {
    switch (id) {
      case "name":
        return (
          <span className="flex min-w-0 items-center gap-2 text-foreground">
            {row.color ? (
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-full border"
                style={{ backgroundColor: row.color }}
              />
            ) : null}
            <span className="truncate">{row.name}</span>
          </span>
        );
      case "path":
        return (
          <span className="block truncate font-mono text-xs" title={row.path}>
            {row.path}
          </span>
        );
      case "level":
        return <span className="tabular-nums">{row.level}</span>;
      case "storage_mode":
        return row.storage_mode ? (labels[`mode_${row.storage_mode}`] ?? row.storage_mode) : "—";
      case "can_store_inventory":
        return row.can_store_inventory ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="size-3.5" aria-hidden="true" />
            {labels.yes}
          </span>
        ) : (
          <span className="text-muted-foreground">{labels.no}</span>
        );
      case "created_at":
        return row.created_at ? (
          <span className="text-xs">
            {new Date(row.created_at).toLocaleString(labels.locale, {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ) : (
          "—"
        );
      default:
        return "—";
    }
  };
  const tickedSet = new Set(ticked);
  const tickedOnPage = rows.filter((row) => tickedSet.has(row.id));
  const selection: TableSelection<LocationListRow> = {
    isSelected: (row) => tickedSet.has(row.id),
    toggle: (row) =>
      onTickedChange(
        tickedSet.has(row.id) ? ticked.filter((id) => id !== row.id) : [...ticked, row.id]
      ),
    all: rows.length > 0 && tickedOnPage.length === rows.length,
    some: tickedOnPage.length > 0,
    toggleAll: () => {
      const pageIds = new Set(rows.map((row) => row.id));
      onTickedChange(
        tickedOnPage.length === rows.length
          ? ticked.filter((id) => !pageIds.has(id))
          : [...new Set([...ticked, ...pageIds])]
      );
    },
    allLabel: labels.selectAll,
    rowLabel: (row) => `${labels.selectRow}: ${row.code ?? row.name}`,
  };
  const pagination = (
    <TablePagination
      sizes={LOCATION_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const codeSort = sortOf("code");
  const CodeSortIcon =
    codeSort.direction === "asc"
      ? ArrowUp
      : codeSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const identity = (row: LocationListRow) => (
    <span className="min-w-0">
      <span className="block truncate font-mono text-[12.5px] font-medium">{row.code ?? "—"}</span>
      <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
        {row.name}
      </span>
    </span>
  );
  const linkProps = (row: LocationListRow) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
  });
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
      )}
    >
      {state.selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={codeSort.href}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1 rounded hover:text-foreground",
                codeSort.direction && "text-foreground"
              )}
            >
              {set.pinned.label}
              <CodeSortIcon
                className={cn("size-3", !codeSort.direction && "opacity-40")}
                aria-hidden="true"
              />
            </PageLink>
          </header>
          <ul>
            {rows.map((row) => {
              const selected = row.id === state.selected;
              return (
                <li key={row.id} data-row-id={row.id}>
                  <PageLink
                    {...linkProps(row)}
                    className={cn(
                      "group flex h-[49px] items-center gap-2.5 border-b px-3 py-1 hover:bg-muted/50",
                      selected &&
                        "border-l-[3px] border-l-primary bg-primary/10 pl-[9px] hover:bg-primary/10"
                    )}
                    aria-current={selected ? "true" : undefined}
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
            columns={shown.map((id) => ({
              id,
              label: set.labels[id],
              sort: SORT_FIELD[id]
                ? sortOf(SORT_FIELD[id])
                : id === "name"
                  ? sortOf("name")
                  : undefined,
            }))}
            rows={rows}
            rowKey={(row) => row.id}
            rowHref={rowHref}
            selected={(row) => row.id === state.selected}
            pinnedSort={codeSort}
            selection={selection}
            pinned={(row) => (
              <PageLink {...linkProps(row)} className="flex min-w-0 items-center gap-2.5 py-1">
                {identity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(
                  TD,
                  id === "level" ? "text-right" : id === "name" ? "" : "text-muted-foreground"
                )}
              >
                {value(row, id)}
              </td>
            )}
            actions={actions}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={labels.empty}
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
            <PageLink href={codeSort.href}>
              {set.pinned.label}{" "}
              {codeSort.direction === "asc" ? "↑" : codeSort.direction === "desc" ? "↓" : "↕"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30">
              <PageLink {...linkProps(row)} className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="min-w-0 flex-1">
                  <strong className="block truncate font-mono text-[13px] font-medium leading-5">
                    {row.code ?? "—"}
                  </strong>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.name}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "name")
                      .map((id) => (
                        <span key={id} className="min-w-0 text-xs">
                          <span className="block text-[10px] text-muted-foreground">
                            {set.labels[id]}
                          </span>
                          <span className="block truncate">{value(row, id)}</span>
                        </span>
                      ))}
                  </span>
                </span>
              </PageLink>
              <div className="ml-1 shrink-0">{actions(row)}</div>
            </li>
          ))}
          {!rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{labels.empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
