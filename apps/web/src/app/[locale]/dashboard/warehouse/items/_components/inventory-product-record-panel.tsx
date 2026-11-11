"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Package, Pencil, X } from "lucide-react";
import { getInventoryProductAction } from "@/app/actions/warehouse/inventory";
import { ItemStockPanel } from "@/components/warehouse/item-stock-panel";
import type { InventoryCustomFieldDefinition } from "@/lib/warehouse/inventory-types";
import { cn } from "@/lib/utils";
import { InventoryRichTextDisplay } from "./inventory-rich-text";
import { inventoryProductKeys } from "./inventory-product-query";
import type { ProductState } from "./inventory-products-state";
import { ProductStatus } from "./inventory-products-table";

const DETAIL_STALE_TIME = 5 * 60 * 1000;
const DETAIL_GC_TIME = 30 * 60 * 1000;

function DetailProperty({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(8rem,0.8fr)_minmax(0,1.2fr)] gap-4 border-b py-2.5 text-sm last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{children}</dd>
    </div>
  );
}

function PanelLoading({ labels }: { labels: Record<string, string> }) {
  return (
    <div className="flex flex-1 flex-col" aria-label={labels.preview} aria-busy="true">
      <div className="flex gap-4 p-5">
        <div className="size-16 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-px border-y bg-border">
        {[0, 1, 2].map((key) => (
          <div key={key} className="space-y-2 bg-background p-4">
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="h-7 w-20 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProductRecordPanel({
  selectionId,
  scope,
  state,
  labels,
  customFields,
  canManageProducts,
  canReadStock,
  fullPath,
  editPath,
  onClose,
  onTabChange,
}: {
  selectionId: string;
  scope: string;
  state: ProductState;
  path: string;
  labels: Record<string, string>;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
  canReadStock: boolean;
  fullPath: string;
  editPath: string;
  onClose: () => void;
  onTabChange: (tab: ProductState["tab"]) => void;
}) {
  const productId = selectionId.split("::")[0];
  const query = useQuery({
    queryKey: inventoryProductKeys.detail(scope, productId),
    queryFn: async () => {
      const result = await getInventoryProductAction({ id: productId });
      if (!result.success || !("data" in result)) {
        throw new Error("error" in result ? result.error : labels.loadError);
      }
      return result.data;
    },
    staleTime: DETAIL_STALE_TIME,
    gcTime: DETAIL_GC_TIME,
  });
  const detail = query.data;
  const activeTab = state.tab === "stock" && !canReadStock ? "info" : state.tab;
  const tabs = [
    { key: "info" as const, label: labels.info },
    {
      key: "variants" as const,
      label: `${labels.variants}${detail ? ` (${detail.variants.length})` : ""}`,
    },
    ...(canReadStock ? [{ key: "stock" as const, label: labels.stock }] : []),
  ];

  return (
    <aside
      aria-labelledby="inventory-product-panel-title"
      className="products-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-xl flex-col overflow-hidden border-l bg-background shadow-2xl xl:static xl:z-auto xl:min-w-0 xl:flex-1 xl:max-w-none xl:shadow-none"
    >
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
          <span>{labels.title}</span>
        </button>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-sm text-muted-foreground">{labels.preview}</span>
        <div className="ml-auto flex items-center gap-1">
          <Link
            href={fullPath}
            className="inline-grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={labels.fullCard}
          >
            <ExternalLink className="size-4" />
          </Link>
          {canManageProducts ? (
            <Link
              href={editPath}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium hover:bg-muted"
            >
              <Pencil className="size-3.5" />
              {labels.edit}
            </Link>
          ) : null}
        </div>
      </header>

      {query.isPending ? <PanelLoading labels={labels} /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center p-8 text-center text-sm">
          <div>
            <p className="text-destructive">{query.error.message}</p>
            <button className="mt-3 underline" type="button" onClick={() => query.refetch()}>
              {labels.retry}
            </button>
          </div>
        </div>
      ) : null}
      {detail ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-start gap-4 px-5 py-5">
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
              {detail.thumbnail_url ? (
                <Image
                  src={detail.thumbnail_url}
                  alt=""
                  width={64}
                  height={64}
                  unoptimized
                  className="size-full object-contain"
                />
              ) : (
                <Package className="size-7 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 pt-0.5">
              <h2
                id="inventory-product-panel-title"
                className="text-xl font-semibold tracking-tight"
              >
                {detail.name}
              </h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{detail.sku || labels.noSku}</span>
                <ProductStatus
                  value={detail.status}
                  label={labels[detail.status] ?? detail.status}
                />
                <span>{labels[detail.product_type] ?? detail.product_type}</span>
              </div>
            </div>
          </div>

          <dl className="grid grid-cols-3 border-y bg-border">
            {[
              [labels.onHand, detail.on_hand_quantity],
              [labels.available, detail.available_quantity],
              [labels.reserved, detail.reserved_total_quantity],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 bg-background px-4 py-3.5">
                <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {value}{" "}
                  <small className="text-xs font-normal text-muted-foreground">
                    {detail.unit_code}
                  </small>
                </dd>
              </div>
            ))}
          </dl>

          <nav className="flex gap-6 border-b px-5" aria-label={labels.sections}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => onTabChange(tab.key)}
                className={cn(
                  "border-b-2 px-0 py-3 text-sm",
                  activeTab === tab.key
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "info" ? (
            <div className="grid gap-6 p-5 2xl:grid-cols-2">
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {labels.info}
                </h3>
                <dl>
                  <DetailProperty label={labels.sku}>{detail.sku || "—"}</DetailProperty>
                  <DetailProperty label={labels.type}>
                    {labels[detail.product_type] ?? detail.product_type}
                  </DetailProperty>
                  <DetailProperty label={labels.unit}>{detail.unit_code}</DetailProperty>
                  <DetailProperty label={labels.brand}>{detail.brand_name || "—"}</DetailProperty>
                  <DetailProperty label={labels.manufacturer}>
                    {detail.manufacturer_name || "—"}
                  </DetailProperty>
                  <DetailProperty label={labels.returnable}>
                    {detail.returnable ? labels.yes : labels.no}
                  </DetailProperty>
                  {customFields
                    .filter((field) => detail.custom_field_values[field.id])
                    .map((field) => (
                      <DetailProperty key={field.id} label={field.name}>
                        {detail.custom_field_values[field.id]}
                      </DetailProperty>
                    ))}
                </dl>
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {labels.description}
                </h3>
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  <InventoryRichTextDisplay value={detail.description} emptyText="—" />
                </div>
                {detail.images.some((image) => image.public_url) ? (
                  <div className="mt-5 grid grid-cols-4 gap-2">
                    {detail.images
                      .filter((image) => image.public_url)
                      .map((image) => (
                        <a
                          key={image.id}
                          href={image.public_url!}
                          target="_blank"
                          rel="noreferrer"
                          className="overflow-hidden rounded-md border"
                        >
                          <Image
                            src={image.public_url!}
                            alt={image.file_name ?? detail.name}
                            width={120}
                            height={120}
                            unoptimized
                            className="aspect-square w-full object-contain"
                          />
                        </a>
                      ))}
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          {activeTab === "variants" ? (
            <div className="divide-y">
              {detail.variants.map((variant) => (
                <div
                  key={variant.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-5 py-3 text-sm"
                >
                  <div className="min-w-0">
                    <strong className="block truncate font-medium">{variant.name}</strong>
                    <span className="font-mono text-xs text-muted-foreground">{variant.sku}</span>
                  </div>
                  <ProductStatus
                    value={variant.status}
                    label={labels[variant.status] ?? variant.status}
                  />
                  <span className="tabular-nums">
                    {variant.available_quantity} {detail.unit_code}
                  </span>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === "stock" && canReadStock ? (
            <div className="space-y-4 p-5">
              <ItemStockPanel productId={detail.id} showSku={detail.variant_count > 1} />
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}
