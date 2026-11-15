import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
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
  const href = (patch: Partial<RepairOrderState>) => repairOrderHref(path, state, patch);
  const sortOf = (field: RepairOrderSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
    }),
    direction: state.sort === field ? state.direction : null,
  });
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
    <ListPane
      rows={data.rows}
      totalCount={data.totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={REPAIR_ORDER_PAGE_SIZES}
      selected={null}
      rowKey={(row) => row.id}
      rowHref={(row) => orderPath(row.id)}
      pageHref={(page) => href({ strona: page })}
      sizeHref={(size) => href({ wierszy: size as RepairOrderState["wierszy"], strona: 1 })}
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={(id) => (SORT_FIELD[id] ? sortOf(SORT_FIELD[id]) : undefined)}
      identity={identity}
      value={value}
      badge={(row) => value(row, "status")}
      cardHidden={["status"]}
      actions={actions}
      cellClassName={(id) =>
        id === "status" || id === "client" ? undefined : "text-muted-foreground"
      }
      labels={labels}
      empty={empty}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
    />
  );
}
