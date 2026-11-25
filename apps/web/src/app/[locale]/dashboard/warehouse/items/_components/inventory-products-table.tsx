import { InventoryImage } from "@/components/warehouse/inventory-image";
import { Package, Pencil, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { ListPane } from "@/components/data-table/list-pane";
import {
  type ColumnLayout,
  type ColumnSet,
  type ColumnWidths,
} from "@/components/data-table/columns";
import { RowActions, RowActionLink } from "@/components/data-table/row-actions";
import type {
  InventoryProductListRow,
  InventoryCustomFieldDefinition,
} from "@/lib/warehouse/inventory-types";
import type { PaginatedResult } from "@/lib/data-view/types";
import { cn } from "@/lib/utils";
import { ProductsBulkBar, rowsToCsv } from "./inventory-products-bulk-bar";
import {
  productHref,
  PAGE_SIZES,
  type ProductSort,
  type ProductState,
} from "./inventory-products-state";
import { formatDateTime } from "@/lib/date-time/format";

/** Columns the list sorts by (the stock sums only for the grouped list). */
const SORTABLE = new Set<string>(["product_type", "status", "updated_at"]);
const STOCK_SORTABLE = new Set<string>([
  "on_hand_quantity",
  "available_quantity",
  "reserved_total_quantity",
  "blocked_quantity",
]);

export function productColumnSet(
  customFields: InventoryCustomFieldDefinition[],
  labels: Record<string, string>
): ColumnSet<string> {
  const ids = [
    "sku",
    "product_type",
    "status",
    "on_hand_quantity",
    "available_quantity",
    "reserved_total_quantity",
    "blocked_quantity",
    "updated_at",
    ...customFields.map((f) => `custom_field:${f.id}`),
  ];
  return {
    ids,
    labels: {
      sku: labels.sku,
      product_type: labels.type,
      status: labels.status,
      on_hand_quantity: labels.onHand,
      available_quantity: labels.available,
      reserved_total_quantity: labels.reserved,
      blocked_quantity: labels.blocked,
      updated_at: labels.updated,
      ...Object.fromEntries(customFields.map((f) => [`custom_field:${f.id}`, f.name])),
    },
    widths: Object.fromEntries(
      ids.map((id) => [id, id === "updated_at" ? 170 : id === "sku" ? 160 : 140])
    ),
    shownByDefault: [
      "sku",
      "product_type",
      "status",
      "on_hand_quantity",
      "available_quantity",
      "reserved_total_quantity",
      "blocked_quantity",
    ],
    pinned: { id: "name", label: labels.productColumn, width: 310 },
  };
}
export function ProductThumbnail({ src, size = 32 }: { src: string | null; size?: number }) {
  return (
    <span
      data-product-thumbnail=""
      className="inline-grid shrink-0 place-items-center overflow-hidden rounded border bg-muted/40"
      style={{ width: size, height: size }}
    >
      {src ? (
        <InventoryImage
          src={src}
          variant={size > 160 ? "card" : "thumb"}
          width={size}
          height={size}
          className="h-full w-full object-contain"
        />
      ) : (
        <Package className="size-4 text-muted-foreground" />
      )}
    </span>
  );
}
export function ProductStatus({ value, label }: { value: string; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px]",
        value === "active"
          ? "bg-primary/10 text-primary"
          : value === "discontinued"
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-muted-foreground"
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
export function InventoryProductsTable({
  data,
  state,
  path,
  set,
  layout,
  widths,
  cookie,
  labels,
  canManageProducts,
  productPath,
  error,
  loading,
  refreshing,
  onRetry,
  onLayoutChange,
  onPreview,
  onPrefetch,
  ticked,
  onTickedChange,
  canArchive,
}: {
  /** The rows ticked (row ids), for actions on several at once. */
  ticked: string[];
  onTickedChange: (rowIds: string[]) => void;
  canArchive: boolean;
  data: PaginatedResult<InventoryProductListRow>;
  state: ProductState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
  canManageProducts: boolean;
  productPath: (id: string, edit?: boolean) => string;
  error: string | null;
  /** No rows yet (nothing cached for this address). */
  loading: boolean;
  /** Rows shown are the previous ones (or stale) while new ones come. */
  refreshing: boolean;
  onRetry: () => void;
  onLayoutChange: (layout: ColumnLayout) => void;
  onPreview: (selectionId: string | null) => void;
  /** A row the pointer rests on (null: it left), for its card's prefetch. */
  onPrefetch: (selectionId: string | null) => void;
}) {
  const href = (patch: Partial<ProductState>) => productHref(path, state, patch);
  const rowHref = (row: InventoryProductListRow) =>
    href({ selected: state.selected === row.row_id ? null : row.row_id, tab: "info" });
  const sortOf = (field: ProductSort) => ({
    href: href({
      sort: field,
      direction: state.sort === field && state.direction === "asc" ? "desc" : "asc",
      strona: 1,
      selected: null,
    }),
    direction: state.sort === field ? state.direction : null,
  });
  const actions = (row: InventoryProductListRow) => (
    <RowActions label={row.name}>
      <RowActionLink href={rowHref(row)} icon={<ExternalLink className="size-4" />}>
        {labels.preview}
      </RowActionLink>
      <RowActionLink href={productPath(row.id)} icon={<ExternalLink className="size-4" />}>
        {labels.fullCard}
      </RowActionLink>
      {canManageProducts ? (
        <RowActionLink href={productPath(row.id, true)} icon={<Pencil className="size-4" />}>
          {labels.edit}
        </RowActionLink>
      ) : null}
    </RowActions>
  );
  const value = (row: InventoryProductListRow, id: string): ReactNode => {
    switch (id) {
      case "sku":
        return <span className="font-mono text-xs">{row.sku || "—"}</span>;
      case "product_type":
        return labels[row.product_type] ?? row.product_type;
      case "status":
        return <ProductStatus value={row.status} label={labels[row.status] ?? row.status} />;
      case "on_hand_quantity":
        return (
          <span className="tabular-nums">
            {row.on_hand_quantity} <small className="text-muted-foreground">{row.unit_code}</small>
          </span>
        );
      case "available_quantity":
        return (
          <span className={cn("tabular-nums", row.available_quantity <= 0 && "text-destructive")}>
            {row.available_quantity}{" "}
            <small className="text-muted-foreground">{row.unit_code}</small>
          </span>
        );
      case "updated_at":
        return (
          <span className="text-xs text-muted-foreground">
            {formatDateTime(row.updated_at, labels.locale)}
          </span>
        );
      case "reserved_total_quantity":
      case "blocked_quantity":
        return (
          <span
            className={cn(
              "tabular-nums",
              id === "blocked_quantity" && row[id] > 0 && "text-destructive"
            )}
          >
            {row[id] || "—"}
          </span>
        );
      default:
        return row.custom_field_values[id.replace("custom_field:", "")] || "—";
    }
  };
  // Plain values, for the CSV of the ticked rows.
  const plain = (row: InventoryProductListRow, id: string): unknown => {
    switch (id) {
      case "name":
        return row.name;
      case "product_type":
        return labels[row.product_type] ?? row.product_type;
      case "status":
        return labels[row.status] ?? row.status;
      case "updated_at":
        return formatDateTime(row.updated_at, labels.locale);
      case "sku":
      case "on_hand_quantity":
      case "available_quantity":
      case "reserved_total_quantity":
      case "blocked_quantity":
        return row[id];
      default:
        return row.custom_field_values[id.replace("custom_field:", "")] ?? "";
    }
  };
  const tickedSet = new Set(ticked);
  const tickedRows = data.rows.filter((row) => tickedSet.has(row.row_id));
  const selection = {
    isSelected: (row: InventoryProductListRow) => tickedSet.has(row.row_id),
    toggle: (row: InventoryProductListRow) =>
      onTickedChange(
        tickedSet.has(row.row_id)
          ? ticked.filter((id) => id !== row.row_id)
          : [...ticked, row.row_id]
      ),
    all: data.rows.length > 0 && tickedRows.length === data.rows.length,
    some: tickedRows.length > 0,
    toggleAll: () =>
      onTickedChange(
        tickedRows.length === data.rows.length ? [] : data.rows.map((row) => row.row_id)
      ),
    allLabel: labels.bulkSelectAll,
    rowLabel: (row: InventoryProductListRow) => `${labels.bulkSelectRow}: ${row.name}`,
  };
  const nameSort = sortOf("name");
  const productIdentity = (row: InventoryProductListRow) => (
    <>
      <ProductThumbnail src={row.thumbnail_url} size={32} />
      <span className="min-w-0">
        <span data-product-name="" className="block truncate text-[13px] font-medium">
          {row.name}
        </span>
        <span
          data-product-sku=""
          className="block truncate font-mono text-[11px] leading-4 font-normal text-muted-foreground"
        >
          {row.sku || labels.noSku}
        </span>
      </span>
    </>
  );
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  return (
    <ListPane
      rows={data.rows}
      totalCount={data.totalCount}
      page={state.strona}
      size={state.wierszy}
      sizes={PAGE_SIZES}
      selected={state.selected}
      rowKey={(row) => row.row_id}
      rowHref={rowHref}
      pageHref={(page) => href({ strona: page, selected: null })}
      sizeHref={(size) =>
        href({ wierszy: size as ProductState["wierszy"], strona: 1, selected: null })
      }
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      onLayoutChange={onLayoutChange}
      sortOf={(id) =>
        SORTABLE.has(id) || (state.grouped && STOCK_SORTABLE.has(id))
          ? sortOf(id as ProductSort)
          : undefined
      }
      pinnedSort={nameSort}
      identity={productIdentity}
      value={value}
      cardHidden={["sku"]}
      actions={actions}
      cellClassName={(id) =>
        [
          "on_hand_quantity",
          "available_quantity",
          "reserved_total_quantity",
          "blocked_quantity",
        ].includes(id)
          ? "text-right"
          : "text-muted-foreground"
      }
      labels={{ countSuffix: labels.title.toLowerCase(), ...labels }}
      empty={labels.empty}
      loading={loading}
      refreshing={refreshing}
      error={error}
      onRetry={onRetry}
      onPreview={onPreview}
      onPrefetch={onPrefetch}
      selection={selection}
      bulkBar={
        tickedRows.length ? (
          <ProductsBulkBar
            rows={tickedRows}
            canArchive={canArchive}
            labels={labels}
            onClear={() => onTickedChange([])}
            csv={() =>
              rowsToCsv(
                tickedRows,
                [
                  { id: "name", label: set.pinned.label },
                  ...shown.map((id) => ({ id, label: set.labels[id] })),
                ],
                plain
              )
            }
          />
        ) : null
      }
    />
  );
}
