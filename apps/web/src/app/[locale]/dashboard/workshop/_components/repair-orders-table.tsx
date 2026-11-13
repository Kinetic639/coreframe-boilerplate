import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
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
import type { RepairOrderHeader } from "@/server/services/repair-orders.service";
import { cn } from "@/lib/utils";
import type { RepairOrderList } from "./repair-orders-query";
import {
  REPAIR_ORDER_PAGE_SIZES,
  repairOrderHref,
  type RepairOrderSort,
  type RepairOrderState,
} from "./repair-orders-state";

type Row = RepairOrderHeader;

/** Columns the list sorts by (each the order's own field). */
const SORT_FIELD: Record<string, RepairOrderSort> = {
  warehouse: "warehouse_code",
  order_number: "order_number",
  vin: "vin",
  vehicle_brand: "vehicle_brand",
  client: "client_name",
  status: "status",
  created_at: "created_at",
  updated_at: "updated_at",
};

export function repairOrderColumnSet(labels: Record<string, string>): ColumnSet<string> {
  const ids = [
    "warehouse",
    "order_number",
    "vin",
    "vehicle_brand",
    "client",
    "dealer",
    "status",
    "advisor",
    "created_at",
    "updated_at",
  ];
  return {
    ids,
    labels: Object.fromEntries(ids.map((id) => [id, labels[`column_${id}`]])),
    widths: {
      warehouse: 160,
      order_number: 120,
      vin: 180,
      vehicle_brand: 130,
      client: 200,
      dealer: 180,
      status: 130,
      advisor: 170,
      created_at: 150,
      updated_at: 150,
    },
    shownByDefault: [
      "warehouse",
      "order_number",
      "vin",
      "client",
      "status",
      "advisor",
      "created_at",
    ],
    pinned: { id: "order", label: labels.column_order, width: 210 },
  };
}

const STATUS_TONE: Record<string, string> = {
  open: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  closed: "bg-green-500/10 text-green-700 dark:text-green-400",
  archived: "bg-muted text-muted-foreground",
};

export function RepairOrderStatusPill({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px]",
        STATUS_TONE[status] ?? STATUS_TONE.archived
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label ?? status}
    </span>
  );
}

export function RepairOrdersTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  warehouseNames,
  orderPath,
  loading,
  refreshing,
  error,
  onRetry,
  onLayoutChange,
}: {
  data: RepairOrderList;
  state: RepairOrderState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  /** DMS warehouse code → its name in the branch. */
  warehouseNames: Record<string, string>;
  orderPath: (id: string) => string;
  /** Nothing to show yet (no rows of this address in the cache). */
  loading: boolean;
  /** The rows shown are an older address's, new ones are coming. */
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<RepairOrderState>) => repairOrderHref(path, state, patch);
  const sortOf = (field: RepairOrderSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
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
  const mono = (value: string | null) =>
    value ? <span className="font-mono text-xs">{value}</span> : "—";
  const actions = (row: Row) => (
    <RowActions label={row.orderNo ?? row.zlNumber ?? labels.title}>
      <RowActionLink href={orderPath(row.id)} icon={<ExternalLink className="size-4" />}>
        {labels.open}
      </RowActionLink>
    </RowActions>
  );
  const value = (row: Row, id: string): ReactNode => {
    switch (id) {
      case "warehouse":
        return row.warehouseCode ? (
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="font-mono text-xs font-medium text-foreground">
              {row.warehouseCode}
            </span>
            {warehouseNames[row.warehouseCode] ? (
              <span className="truncate">{warehouseNames[row.warehouseCode]}</span>
            ) : null}
          </span>
        ) : (
          "—"
        );
      case "order_number":
        return mono(row.orderNumber);
      case "vin":
        return mono(row.vin);
      case "vehicle_brand":
        return row.vehicleBrand || "—";
      case "client":
        return row.clientName || "—";
      case "dealer":
        return row.dealerName || "—";
      case "status":
        return <RepairOrderStatusPill status={row.status} label={labels[`status_${row.status}`]} />;
      case "advisor":
        return row.advisorDisplayName || "—";
      case "created_at":
        return date(row.createdAt);
      case "updated_at":
        return date(row.updatedAt);
      default:
        return "—";
    }
  };
  const pagination = (
    <TablePagination
      sizes={REPAIR_ORDER_PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1 }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1 }) : null}
      nextHref={page < pages ? href({ strona: page + 1 }) : null}
    />
  );
  /** The order's DMS number first, the whole ZL number under it. */
  const identity = (row: Row) => (
    <span className="min-w-0">
      <span className="block truncate font-mono text-[13px] font-medium">
        {row.orderNo ?? row.zlNumber ?? labels.noNumber}
      </span>
      <span className="block truncate font-mono text-[11px] leading-4 font-normal text-muted-foreground">
        {row.orderNo ? row.zlNumber : (row.vin ?? " ")}
      </span>
    </span>
  );
  const createdSort = sortOf("created_at");
  const empty = loading
    ? labels.loading
    : error
      ? labels.loadError
      : state.q ||
          state.status.length ||
          state.magazyn.length ||
          state.doradca.length ||
          state.utworzono ||
          state.utworzono_od ||
          state.utworzono_do
        ? labels.empty
        : labels.emptyAll;
  return (
    <div
      className="ks-list-pane relative flex min-h-0 min-w-0 flex-1 flex-col"
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
          rowKey={(row) => row.id}
          rowHref={(row) => orderPath(row.id)}
          selected={() => false}
          pinned={(row) => (
            <PageLink
              href={orderPath(row.id)}
              className="flex min-w-0 items-center py-1"
              data-testid="repair-order-row"
            >
              {identity(row)}
            </PageLink>
          )}
          cell={(row, id) => (
            <td
              key={id}
              className={cn(TD, id === "status" || id === "client" ? "" : "text-muted-foreground")}
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
      <div className="ks-list-mobile min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {data.totalCount} {labels.countSuffix}
          </span>
          <div className="flex items-center gap-2">
            <PageLink href={createdSort.href}>
              {labels.column_created_at}{" "}
              {createdSort.direction === "asc" ? "↑" : createdSort.direction === "desc" ? "↓" : "↕"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {data.rows.map((row) => (
            <li key={row.id} className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30">
              <PageLink
                href={orderPath(row.id)}
                className="flex min-w-0 flex-1 items-start gap-2.5"
                data-testid="repair-order-card"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    {identity(row)}
                    {value(row, "status")}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "status")
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
