import Image from "next/image";
import { ArrowDown, ArrowUp, ChevronsUpDown, Package, Pencil, ExternalLink } from "lucide-react";
import type { MouseEvent, ReactNode } from "react";
import { PageLink } from "@/components/kolor-sensu/public-site/page-link";
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
import type {
  InventoryProductListRow,
  InventoryCustomFieldDefinition,
} from "@/lib/warehouse/inventory-types";
import type { PaginatedResult } from "@/lib/data-view/types";
import { cn } from "@/lib/utils";
import { productHref, PAGE_SIZES, type ProductState } from "./inventory-products-state";

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
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          unoptimized
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
  onPreview,
  onPrefetch,
}: {
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
  onPreview: (selectionId: string | null) => void;
  onPrefetch: (selectionId: string) => void;
}) {
  const shown = layout.filter((c) => c.shown).map((c) => c.id);
  const { page, pages, range } = pageState(
    { page: state.strona, size: state.wierszy },
    data.totalCount,
    data.rows.length
  );
  const href = (patch: Partial<ProductState>) => productHref(path, state, patch);
  const rowHref = (row: InventoryProductListRow) =>
    href({ selected: state.selected === row.row_id ? null : row.row_id, tab: "info" });
  const openPreview = (event: MouseEvent, row: InventoryProductListRow) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    event.preventDefault();
    onPreview(state.selected === row.row_id ? null : row.row_id);
  };
  const sortOf = (field: "name" | "product_type" | "status" | "updated_at") => ({
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
      pinnedLabel={set.pinned.label}
    />
  );
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
            {new Date(row.updated_at).toLocaleString(labels.locale)}
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
  const pagination = (
    <TablePagination
      sizes={PAGE_SIZES.map((size) => ({
        size,
        current: state.wierszy === size,
        href: href({ wierszy: size, strona: 1, selected: null }),
      }))}
      range={range}
      previousHref={page > 1 ? href({ strona: page - 1, selected: null }) : null}
      nextHref={page < pages ? href({ strona: page + 1, selected: null }) : null}
    />
  );
  const nameSort = sortOf("name");
  const NameSortIcon =
    nameSort.direction === "asc"
      ? ArrowUp
      : nameSort.direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;
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
  return (
    <div
      className={cn(
        "products-list-pane flex min-h-0 min-w-0 flex-1 flex-col",
        state.selected && "products-list-pane--preview"
      )}
    >
      {error ? (
        <div role="alert" className="border-b bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {labels.loadError} <span className="block text-xs">{error}</span>
          <PageLink href={href({})} className="underline">
            {labels.retry}
          </PageLink>
        </div>
      ) : null}
      {state.selected ? (
        <aside
          className="products-desktop-mini-list min-h-0 flex-1 overflow-y-auto border-r bg-background"
          aria-label={labels.title}
        >
          <header className="sticky top-0 z-10 flex h-[34px] items-center border-b bg-muted/70 px-3 text-[10px] font-medium text-muted-foreground backdrop-blur-sm">
            <PageLink
              href={nameSort.href}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1 rounded hover:text-foreground",
                nameSort.direction && "text-foreground"
              )}
            >
              {set.pinned.label}
              <NameSortIcon
                className={cn("size-3", !nameSort.direction && "opacity-40")}
                aria-hidden="true"
              />
            </PageLink>
          </header>
          <ul>
            {data.rows.map((row) => {
              const selected = row.row_id === state.selected;
              return (
                <li key={row.row_id}>
                  <PageLink
                    href={rowHref(row)}
                    scroll={false}
                    onClick={(event) => openPreview(event, row)}
                    onMouseEnter={() => onPrefetch(row.row_id)}
                    onFocus={() => onPrefetch(row.row_id)}
                    className={cn(
                      "group flex h-[49px] items-center gap-2.5 border-b px-3 py-1 hover:bg-muted/50",
                      selected &&
                        "border-l-[3px] border-l-primary bg-primary/10 pl-[9px] hover:bg-primary/10"
                    )}
                    aria-current={selected ? "true" : undefined}
                  >
                    {productIdentity(row)}
                  </PageLink>
                </li>
              );
            })}
          </ul>
        </aside>
      ) : (
        <div className="products-desktop-table min-h-0 flex-1 flex-col">
          <DataTable
            caption={labels.title}
            set={set}
            columns={shown.map((id) => ({
              id,
              label: set.labels[id],
              sort: ["product_type", "status", "updated_at"].includes(id)
                ? sortOf(id as "product_type" | "status" | "updated_at")
                : undefined,
            }))}
            rows={data.rows}
            rowKey={(row) => row.row_id}
            rowHref={rowHref}
            selected={(row) => row.row_id === state.selected}
            pinnedSort={nameSort}
            pinned={(row, url) => (
              <PageLink
                href={url}
                scroll={false}
                onClick={(event) => openPreview(event, row)}
                onMouseEnter={() => onPrefetch(row.row_id)}
                onFocus={() => onPrefetch(row.row_id)}
                className="flex min-w-0 items-center gap-2.5 py-1"
              >
                {productIdentity(row)}
              </PageLink>
            )}
            cell={(row, id) => (
              <td
                key={id}
                className={cn(
                  TD,
                  [
                    "on_hand_quantity",
                    "available_quantity",
                    "reserved_total_quantity",
                    "blocked_quantity",
                  ].includes(id)
                    ? "text-right"
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
            empty={error ? labels.loadError : labels.empty}
            pagination={pagination}
          />
        </div>
      )}
      <div className="products-mobile-list min-h-0 flex-1 flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b px-3 text-xs text-muted-foreground">
          <span>
            {data.totalCount} {labels.title.toLowerCase()}
          </span>
          <div className="flex items-center gap-2">
            <PageLink
              href={href({
                sort: "name",
                direction: state.direction === "asc" ? "desc" : "asc",
                strona: 1,
                selected: null,
              })}
            >
              {labels.sortName}{" "}
              {state.sort === "name" ? (state.direction === "asc" ? "↑" : "↓") : "↕"}
            </PageLink>
            {menu}
          </div>
        </header>
        <ul className="min-h-0 flex-1 overflow-auto overscroll-contain">
          {data.rows.map((row) => (
            <li
              key={row.row_id}
              className="flex items-start border-b px-3 py-2.5 hover:bg-muted/30"
            >
              <PageLink
                href={rowHref(row)}
                scroll={false}
                onClick={(event) => openPreview(event, row)}
                onMouseEnter={() => onPrefetch(row.row_id)}
                onFocus={() => onPrefetch(row.row_id)}
                className="flex min-w-0 flex-1 items-start gap-2.5"
              >
                <ProductThumbnail src={row.thumbnail_url} size={42} />
                <span className="min-w-0 flex-1">
                  <strong className="block text-[13px] font-medium leading-5">{row.name}</strong>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {row.sku || labels.noSku}
                  </span>
                  <span className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-1">
                    {shown
                      .filter((id) => id !== "sku")
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
            <li className="px-4 py-12 text-center text-sm text-muted-foreground">
              {error ? labels.loadError : labels.empty}
            </li>
          ) : null}
        </ul>
        {pagination}
      </div>
    </div>
  );
}
