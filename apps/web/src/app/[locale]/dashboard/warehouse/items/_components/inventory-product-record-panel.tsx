import Image from "next/image";
import { ExternalLink, Pencil, X } from "lucide-react";
import {
  VisitPanelMotion,
  VisitPanelCloseLink,
} from "@/components/kolor-sensu/visit-table/visit-panel-motion";
import { VisitPanelTabs } from "@/components/kolor-sensu/visit-table/visit-panel-tabs";
import {
  DetailSection,
  DetailProp,
  DetailProps,
  DETAIL_BUTTON,
} from "@/components/kolor-sensu/detail-page/detail-page";
import { PageLink } from "@/components/kolor-sensu/public-site/page-link";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductDetail,
} from "@/lib/warehouse/inventory-types";
import { productHref, type ProductState } from "./inventory-products-state";
import { ProductStatus, ProductThumbnail } from "./inventory-products-table";
import { InventoryRichTextDisplay } from "./inventory-rich-text";
import { ItemStockPanel } from "@/components/warehouse/item-stock-panel";

export function ProductRecordPanel({
  detail,
  error,
  state,
  path,
  labels,
  customFields,
  canManageProducts,
  canReadStock,
  fullPath,
  editPath,
}: {
  detail: InventoryProductDetail | null;
  error: string | null;
  state: ProductState;
  path: string;
  labels: Record<string, string>;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
  canReadStock: boolean;
  fullPath: string;
  editPath: string;
}) {
  const closeHref = productHref(path, state, { selected: null, tab: "info" });
  return (
    <VisitPanelMotion
      visitId={state.selected!}
      closeHref={closeHref}
      labelledBy="inventory-product-panel-title"
      className="products-panel fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-full max-w-md flex-col overflow-hidden border-l bg-background shadow-xl xl:static xl:z-auto xl:w-[430px] xl:max-w-none xl:shrink-0 xl:shadow-none"
    >
      <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <h2
          id="inventory-product-panel-title"
          className="min-w-0 flex-1 truncate text-sm font-semibold"
        >
          {detail?.name ?? labels.preview}
        </h2>
        <VisitPanelCloseLink
          href={closeHref}
          aria-label={labels.close}
          className="inline-grid size-11 shrink-0 place-items-center rounded hover:bg-muted md:size-8"
        >
          <X className="size-4" />
        </VisitPanelCloseLink>
      </header>
      {detail ? (
        <>
          <div className="product-panel-summary flex shrink-0 items-center gap-3 border-b p-3">
            <ProductThumbnail src={detail.thumbnail_url} size={48} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-mono text-xs text-muted-foreground">
                {detail.sku || labels.noSku}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <ProductStatus
                  value={detail.status}
                  label={labels[detail.status] ?? detail.status}
                />
                <span className="text-xs text-muted-foreground">
                  {labels[detail.product_type] ?? detail.product_type}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2 border-b px-3 py-2">
            <PageLink href={fullPath} className={DETAIL_BUTTON}>
              <ExternalLink />
              {labels.fullCard}
            </PageLink>
            {canManageProducts ? (
              <PageLink href={editPath} className={DETAIL_BUTTON}>
                <Pencil />
                {labels.edit}
              </PageLink>
            ) : null}
          </div>
          <VisitPanelTabs
            key={detail.id + state.tab}
            initial={state.tab === "stock" && !canReadStock ? "info" : state.tab}
            label={labels.sections}
            tabs={[
              { key: "info", label: labels.info, href: productHref(path, state, { tab: "info" }) },
              {
                key: "variants",
                label: `${labels.variants} (${detail.variants.length})`,
                href: productHref(path, state, { tab: "variants" }),
              },
              ...(canReadStock
                ? [
                    {
                      key: "stock",
                      label: labels.stock,
                      href: productHref(path, state, { tab: "stock" }),
                    },
                  ]
                : []),
            ]}
            panes={{
              info: (
                <>
                  <DetailSection title={labels.info}>
                    <DetailProps>
                      <DetailProp label={labels.sku}>{detail.sku || "—"}</DetailProp>
                      <DetailProp label={labels.type}>
                        {labels[detail.product_type] ?? detail.product_type}
                      </DetailProp>
                      <DetailProp label={labels.unit}>{detail.unit_code}</DetailProp>
                      <DetailProp label={labels.brand}>{detail.brand_name || "—"}</DetailProp>
                      <DetailProp label={labels.manufacturer}>
                        {detail.manufacturer_name || "—"}
                      </DetailProp>
                      <DetailProp label={labels.returnable}>
                        {detail.returnable ? labels.yes : labels.no}
                      </DetailProp>
                      <DetailProp label={labels.updated}>
                        {new Date(detail.updated_at).toLocaleString(labels.locale)}
                      </DetailProp>
                      {customFields
                        .filter((f) => detail.custom_field_values[f.id])
                        .map((f) => (
                          <DetailProp key={f.id} label={f.name}>
                            {detail.custom_field_values[f.id]}
                          </DetailProp>
                        ))}
                    </DetailProps>
                  </DetailSection>
                  <DetailSection title={labels.description}>
                    <div className="p-3 text-sm text-muted-foreground">
                      <InventoryRichTextDisplay value={detail.description} emptyText="—" />
                    </div>
                  </DetailSection>
                  {detail.tags.length ? (
                    <DetailSection title={labels.tags}>
                      <div className="flex flex-wrap gap-1 p-3">
                        {detail.tags.map((tag) => (
                          <span key={tag} className="rounded bg-muted px-2 py-1 text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </DetailSection>
                  ) : null}
                  {detail.images.some((i) => i.public_url) ? (
                    <DetailSection title={labels.images}>
                      <div className="grid grid-cols-3 gap-2 p-3">
                        {detail.images
                          .filter((i) => i.public_url)
                          .map((i) => (
                            <a
                              key={i.id}
                              href={i.public_url!}
                              target="_blank"
                              rel="noreferrer"
                              className="overflow-hidden rounded border"
                            >
                              <Image
                                src={i.public_url!}
                                alt={i.file_name ?? detail.name}
                                width={120}
                                height={120}
                                unoptimized
                                className="aspect-square w-full object-contain"
                              />
                            </a>
                          ))}
                      </div>
                    </DetailSection>
                  ) : null}
                </>
              ),
              variants: (
                <>
                  {detail.variants.map((v) => (
                    <details key={v.id} className="border-b">
                      <summary className="flex cursor-pointer items-center gap-2 p-3 text-sm">
                        <ProductThumbnail src={v.thumbnail_url} />
                        <span className="min-w-0">
                          <strong className="block truncate font-medium">{v.name}</strong>
                          <span className="font-mono text-xs text-muted-foreground">{v.sku}</span>
                        </span>
                      </summary>
                      <DetailProps>
                        <DetailProp label={labels.status}>
                          {labels[v.status] ?? v.status}
                        </DetailProp>
                        <DetailProp label={labels.barcode}>{v.barcode || "—"}</DetailProp>
                        <DetailProp label={labels.purchase}>
                          {v.purchase_price == null
                            ? "—"
                            : `${v.purchase_price} ${v.price_currency}`}
                        </DetailProp>
                        <DetailProp label={labels.sales}>
                          {v.sales_price == null ? "—" : `${v.sales_price} ${v.price_currency}`}
                        </DetailProp>
                        {v.option_values.map((o) => (
                          <DetailProp key={o.option_value_id} label={o.option_group_name}>
                            {o.value}
                          </DetailProp>
                        ))}
                        {customFields
                          .filter((f) => v.custom_field_values[f.id])
                          .map((f) => (
                            <DetailProp key={f.id} label={f.name}>
                              {v.custom_field_values[f.id]}
                            </DetailProp>
                          ))}
                      </DetailProps>
                    </details>
                  ))}
                </>
              ),
              stock: canReadStock ? (
                <>
                  <DetailSection title={labels.stock}>
                    <DetailProps>
                      <DetailProp label={labels.onHand}>
                        {detail.on_hand_quantity} {detail.unit_code}
                      </DetailProp>
                      <DetailProp label={labels.available}>
                        {detail.available_quantity} {detail.unit_code}
                      </DetailProp>
                      <DetailProp label={labels.reserved}>
                        {detail.reserved_total_quantity || "—"}
                      </DetailProp>
                      <DetailProp label={labels.blocked}>
                        {detail.blocked_quantity || "—"}
                      </DetailProp>
                    </DetailProps>
                  </DetailSection>
                  <ItemStockPanel productId={detail.id} showSku={detail.variant_count > 1} />
                  {detail.variants.map((v) => (
                    <DetailSection key={v.id} title={v.name} note={v.sku}>
                      <DetailProps>
                        <DetailProp label={labels.onHand}>
                          {v.on_hand_quantity} {detail.unit_code}
                        </DetailProp>
                        <DetailProp label={labels.available}>
                          {v.available_quantity} {detail.unit_code}
                        </DetailProp>
                        <DetailProp label={labels.reorderPoint}>
                          {v.reorder_point ?? "—"}
                        </DetailProp>
                      </DetailProps>
                    </DetailSection>
                  ))}
                </>
              ) : null,
            }}
          />
        </>
      ) : (
        <div className="p-4 text-sm" role={error ? "alert" : "status"}>
          <p>{error ? labels.loadError : labels.notFound}</p>
          {error ? (
            <PageLink href={productHref(path, state)} className="text-primary underline">
              {labels.retry}
            </PageLink>
          ) : null}
        </div>
      )}
    </VisitPanelMotion>
  );
}
