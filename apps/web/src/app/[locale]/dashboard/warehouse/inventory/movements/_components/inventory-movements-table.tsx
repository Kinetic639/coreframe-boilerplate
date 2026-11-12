import { ArrowDown, ArrowUp, ChevronsUpDown, ExternalLink, Eye, Pencil } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { TableLink as PageLink } from "@/components/kolor-sensu/data-table/table-navigation";
import {
  DataTable,
  TablePagination,
  pageState,
  TD,
} from "@/components/kolor-sensu/data-table/data-table";
import { ColumnsMenu } from "@/components/kolor-sensu/data-table/columns-menu";
import {
  defaultLayout,
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/kolor-sensu/data-table/columns";
import { RowActions, RowActionLink } from "@/components/kolor-sensu/row-actions";
import type { InventoryMovementListRow } from "@/lib/warehouse/inventory-types";
import { cn } from "@/lib/utils";
import type { MovementList } from "./inventory-movements-query";
import {
  movementHref,
  MOVEMENT_PAGE_SIZES,
  type MovementSort,
  type MovementState,
} from "./inventory-movements-state";

/** Columns the list sorts by (each the movement's own field). */
const SORT_FIELD: Record<string, MovementSort> = {
  movement_type: "movement_type_code",
  status: "status",
  posted_at: "posted_at",
  created_at: "created_at",
};

export function movementColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "movement_type",
    "status",
    "warehouse",
    "external_reference",
    "counterparty",
    "line_count",
    "posted_at",
    "created_at",
  ];
  return {
    ids,
    labels: {
      movement_type: labels.kind,
      status: labels.status,
      warehouse: labels.warehouse,
      external_reference: labels.reference,
      counterparty: labels.counterparty,
      line_count: labels.lines,
      posted_at: labels.posted,
      created_at: labels.created,
    },
    widths: {
      movement_type: 200,
      status: 130,
      warehouse: 130,
      external_reference: 220,
      counterparty: 200,
      line_count: 80,
      posted_at: 160,
      created_at: 160,
    },
    shownByDefault: [
      "movement_type",
      "status",
      "warehouse",
      "external_reference",
      "line_count",
      "posted_at",
    ],
    pinned: { id: "document_number", label: labels.movement, width: 230 },
  };
}

const STATUS_TONE: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  posted: "bg-primary/10 text-primary",
  accepted: "bg-primary/10 text-primary",
  in_transit: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  reversed: "bg-muted text-muted-foreground line-through decoration-1",
  cancelled: "bg-destructive/10 text-destructive",
  declined: "bg-destructive/10 text-destructive",
};

export function MovementStatus({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px]",
        STATUS_TONE[value] ?? "bg-muted text-muted-foreground"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

export const movementNumber = (row: {
  document_number: string | null;
  draft_number: string | null;
}) => row.document_number ?? row.draft_number ?? "—";

export function InventoryMovementsTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  canOperate,
  movementPath,
  error,
  loading,
  refreshing,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
}: {
  data: MovementList;
  state: MovementState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canOperate: boolean;
  movementPath: (routeKey: string, edit?: boolean) => string;
  error: string | null;
  /** No rows yet (nothing cached for this address). */
  loading: boolean;
  /** Rows shown are the previous ones (or stale) while new ones come. */
  refreshing: boolean;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (routeKey: string | null) => void;
  /** A row the pointer rests on (null: it left), for its card's prefetch. */
  onPrefetch: (routeKey: string | null) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<MovementState>) => movementHref(path, state, patch);
  const rowHref = (row: InventoryMovementListRow) =>
    href({ selected: state.selected === row.route_key ? null : row.route_key });
  const openPreview = (event: MouseEvent, row: InventoryMovementListRow) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.route_key ? null : row.route_key);
  };
  const sortOf = (field: MovementSort) => ({
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
  const date = (value: string | null) =>
    value ? (
      <span className="text-xs text-muted-foreground">
        {new Date(value).toLocaleString(labels.locale, {
          dateStyle: "short",
          timeStyle: "short",
        })}
      </span>
    ) : (
      "—"
    );
  const actions = (row: InventoryMovementListRow) => (
    <RowActions label={movementNumber(row)}>
      <RowActionLink href={rowHref(row)} icon={<Eye className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink href={movementPath(row.route_key)} icon={<ExternalLink className="size-4" />}>
        {labels.openMovement}
      </RowActionLink>
      {canOperate && row.status === "draft" ? (
        <RowActionLink
          href={movementPath(row.route_key, true)}
          icon={<Pencil className="size-4" />}
        >
          {labels.editDraft}
        </RowActionLink>
      ) : null}
    </RowActions>
  );
  const value = (row: InventoryMovementListRow, id: string): ReactNode => {
    switch (id) {
      case "movement_type":
        return (
          <span className="truncate">
            <span className="mr-1.5 font-mono text-[11px] text-muted-foreground">
              {row.movement_type_code}
            </span>
            {row.movement_type_name}
          </span>
        );
      case "status":
        return (
          <MovementStatus value={row.status} label={labels[`status_${row.status}`] ?? row.status} />
        );
      case "warehouse":
        return row.warehouse_code ? (
          <span className="font-mono text-xs" title={row.warehouse_name ?? undefined}>
            {row.warehouse_code}
            {row.unit_code ? (
              <span className="text-muted-foreground"> · {row.unit_code}</span>
            ) : null}
          </span>
        ) : (
          "—"
        );
      case "external_reference":
        return row.external_reference ? (
          <span className="font-mono text-xs" title={row.external_reference}>
            {row.external_reference}
          </span>
        ) : (
          "—"
        );
      case "counterparty":
        return row.sender_name ?? row.recipient_name ?? "—";
      case "line_count":
        return <span className="tabular-nums">{row.line_count}</span>;
      case "posted_at":
        return date(row.posted_at);
      case "created_at":
        return date(row.created_at);
      default:
        return "—";
    }
  };
  const pagination = (
    <TablePagination
      sizes={MOVEMENT_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const numberSort = sortOf("document_number");
  const NumberSortIcon =
    numberSort.direction === "asc"
      ? ArrowUp
      : numberSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
  const identity = (row: InventoryMovementListRow) => (
    <span className="min-w-0">
      <span className="block truncate font-mono text-[12.5px] font-medium">
        {movementNumber(row)}
      </span>
      <span className="block truncate text-[11px] leading-4 font-normal text-muted-foreground">
        {row.movement_type_name}
      </span>
    </span>
  );
  const linkProps = (row: InventoryMovementListRow) => ({
    href: rowHref(row),
    scroll: false,
    onClick: (event: MouseEvent) => openPreview(event, row),
    onMouseEnter: () => onPrefetch(row.route_key),
    onMouseLeave: () => onPrefetch(null),
    onFocus: () => onPrefetch(row.route_key),
  });
  const empty = loading ? labels.loading : error ? labels.loadError : labels.empty;
  return (
    <div
      className={cn(
        "ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "ks-list-pane--preview"
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
          <button type="button" onClick={onRetry} className="underline">
            {labels.retry}
          </button>
        </div>
      ) : null}
      {state.selected ? (
        <aside
          className="ks-list-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={numberSort.href}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1 rounded hover:text-foreground",
                numberSort.direction && "text-foreground"
              )}
            >
              {set.pinned.label}
              <NumberSortIcon
                className={cn("size-3", !numberSort.direction && "opacity-40")}
                aria-hidden="true"
              />
            </PageLink>
          </header>
          <ul>
            {data.rows.map((row) => {
              const selected = row.route_key === state.selected;
              return (
                <li key={row.id} data-row-id={row.route_key}>
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
              sort: SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined,
            }))}
            rows={data.rows}
            rowKey={(row) => row.route_key}
            rowHref={rowHref}
            selected={(row) => row.route_key === state.selected}
            pinnedSort={numberSort}
            onRowIntent={(row) => onPrefetch(row ? row.route_key : null)}
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
                  id === "line_count"
                    ? "text-right"
                    : id === "status"
                      ? ""
                      : "text-muted-foreground"
                )}
              >
                {value(row, id)}
              </td>
            )}
            actions={actions}
            menu={menu}
            widths={widths}
            widthsCookie={`${cookie}_widths`}
            empty={empty}
            pagination={pagination}
          />
        </div>
      )}
      <div className="ks-list-mobile min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {data.totalCount} {labels.countSuffix}
          </span>
          <div className="flex items-center gap-2">
            <PageLink href={numberSort.href}>
              {set.pinned.label}{" "}
              {numberSort.direction === "asc" ? "↑" : numberSort.direction === "desc" ? "↓" : "↕"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {data.rows.map((row) => (
            <li key={row.id} className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30">
              <PageLink {...linkProps(row)} className="flex min-w-0 flex-1 items-start gap-2.5">
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <strong className="truncate font-mono text-[13px] font-medium leading-5">
                      {movementNumber(row)}
                    </strong>
                    <MovementStatus
                      value={row.status}
                      label={labels[`status_${row.status}`] ?? row.status}
                    />
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {row.movement_type_name}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "status" && id !== "movement_type")
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
          {!data.rows.length ? (
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">{empty}</li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
