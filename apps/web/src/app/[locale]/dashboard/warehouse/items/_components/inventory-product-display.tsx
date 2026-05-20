"use client";

import { memo, useCallback, useMemo, useState } from "react";
import type React from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { ChevronDown, ChevronRight, Edit, PackagePlus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useDataViewUrl } from "@/components/data-view/use-data-view";
import { cn } from "@/lib/utils";
import type {
  InventoryCustomFieldDefinition,
  InventoryProductDetail,
  InventoryProductImageRow,
  InventoryProductListRow,
  InventoryProductVariantListRow,
} from "@/lib/warehouse/inventory-types";

export const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  archived: "secondary",
  discontinued: "destructive",
};

export const ProductSidebarItem = memo(function ProductSidebarItem({
  product,
}: {
  product: InventoryProductListRow;
}) {
  const t = useTranslations("warehouseInventory.common");
  return (
    <span className="flex min-w-0 items-center gap-3">
      <ProductImageThumb src={product.thumbnail_url} className="h-8 w-8" />
      <span className="min-w-0">
        <span className="block truncate font-medium">{product.name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {product.is_variant_row && product.parent_product_name
            ? `${product.parent_product_name} · ${product.sku}`
            : product.variant_count > 1
              ? t("variantsCount", { count: product.variant_count })
              : product.sku}
        </span>
      </span>
    </span>
  );
});

export function VariantGroupingControl() {
  const t = useTranslations("warehouseInventory.list");
  const { urlState } = useDataViewUrl();
  const grouped = urlState.filters.__group_variants !== false;
  const handleGroupingChange = useCallback(
    (checked: boolean) => {
      const next = { ...urlState.filters };
      if (checked) {
        delete next.__group_variants;
        delete next.is_variant;
      } else {
        next.__group_variants = false;
      }
      urlState.setFilters(next);
    },
    [urlState]
  );

  return (
    <label className="flex h-8 shrink-0 items-center gap-2 rounded-md border px-2 text-xs">
      <Switch
        checked={grouped}
        onCheckedChange={handleGroupingChange}
        className="h-4 w-7 [&>span]:h-3 [&>span]:w-3 [&>span]:data-[state=checked]:translate-x-3"
        aria-label={t("groupVariants")}
      />
      <span>{t("groupVariants")}</span>
    </label>
  );
}

export const ExpandedVariantRows = memo(function ExpandedVariantRows({
  product,
}: {
  product: InventoryProductListRow;
}) {
  const t = useTranslations("warehouseInventory.common");
  const tList = useTranslations("warehouseInventory.list");
  return (
    <div className="border-t bg-muted/20 px-14 py-3">
      <div className="overflow-hidden rounded-md border bg-background">
        <div className="grid grid-cols-[48px_minmax(220px,1fr)_160px_180px_120px_120px_120px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>{t("image")}</span>
          <span>{t("variants")}</span>
          <span>{t("sku")}</span>
          <span>{t("attributes")}</span>
          <span className="text-right">{tList("onHand")}</span>
          <span className="text-right">{tList("available")}</span>
          <span>{t("status")}</span>
        </div>
        {product.variants.map((variant) => (
          <div
            key={variant.id}
            className="grid grid-cols-[48px_minmax(220px,1fr)_160px_180px_120px_120px_120px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
          >
            <ProductImageThumb src={variant.thumbnail_url} className="h-9 w-9" />
            <span className="truncate font-medium">{variant.name}</span>
            <span className="truncate text-muted-foreground">{variant.sku}</span>
            <VariantOptionSummary variant={variant} />
            <span className="text-right tabular-nums">
              {variant.on_hand_quantity} {product.unit_code}
            </span>
            <span className="text-right tabular-nums">
              {variant.available_quantity} {product.unit_code}
            </span>
            <span>{variant.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

export function ProductDetailPanel({
  detail,
  customFields,
  canManageProducts,
}: {
  detail: InventoryProductDetail;
  customFields: InventoryCustomFieldDefinition[];
  canManageProducts: boolean;
}) {
  const t = useTranslations("warehouseInventory.common");
  const tList = useTranslations("warehouseInventory.list");
  const tDetail = useTranslations("warehouseInventory.detail");
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [expandedVariantIds, setExpandedVariantIds] = useState<Record<string, true>>({});
  const hasVisibleVariants = detail.variant_count > 1;
  const simpleVariant = hasVisibleVariants ? null : detail.variants[0];
  const productImages = useMemo(
    () =>
      detail.images
        .filter((image) => !image.variant_id)
        .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order),
    [detail.images]
  );
  const selectedImage = useMemo(
    () =>
      productImages.find((image) => image.id === selectedImageId) ??
      productImages.find((image) => image.is_primary) ??
      productImages[0],
    [productImages, selectedImageId]
  );
  const selectedImageUrl = useMemo(
    () => imageUrl(selectedImage) ?? detail.thumbnail_url,
    [detail.thumbnail_url, selectedImage]
  );
  const customFieldRows = useMemo(
    () =>
      customFields
        .map((field) => ({ field, value: detail.custom_field_values[field.id] }))
        .filter((row) => row.value),
    [customFields, detail.custom_field_values]
  );

  return (
    <div className="space-y-5">
      <section className="grid gap-5 xl:grid-cols-[minmax(220px,300px)_1fr]">
        <div className="space-y-3">
          <div className="grid aspect-square max-h-[300px] place-items-center overflow-hidden rounded-md border bg-muted/30">
            {selectedImageUrl ? (
              <Image
                src={selectedImageUrl}
                alt=""
                width={300}
                height={300}
                unoptimized
                className="h-full w-full object-cover"
              />
            ) : (
              <PackagePlus className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          {productImages.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {productImages.map((image) => {
                const url = imageUrl(image);
                if (!url) return null;
                const active = (selectedImage?.id ?? null) === image.id;
                return (
                  <button
                    key={image.id}
                    type="button"
                    className={cn(
                      "h-12 w-12 overflow-hidden rounded border bg-muted",
                      active && "border-primary ring-1 ring-primary"
                    )}
                    onClick={() => setSelectedImageId(image.id)}
                    aria-label={t("primaryImage")}
                  >
                    <Image
                      src={url}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 space-y-4">
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-xl font-semibold">{detail.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {hasVisibleVariants
                    ? t("variantsCount", { count: detail.variant_count })
                    : detail.sku || t("noSku")}
                </p>
              </div>
              <Badge variant={statusVariant[detail.status] ?? "outline"}>{detail.status}</Badge>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              {detail.description ?? t("noDescription")}
            </p>
            <TagChips tags={detail.tags} className="mt-3" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <DetailFact label={t("type")} value={detail.product_type.replace("_", " ")} />
            <DetailFact label={t("unit")} value={detail.unit_code || "-"} />
            <DetailFact
              label={tList("onHand")}
              value={`${detail.on_hand_quantity} ${detail.unit_code}`}
            />
            <DetailFact
              label={tList("available")}
              value={`${detail.available_quantity} ${detail.unit_code}`}
            />
            <DetailFact label={tDetail("brand")} value={detail.brand_name ?? t("notSet")} />
            <DetailFact
              label={tDetail("manufacturer")}
              value={detail.manufacturer_name ?? t("notSet")}
            />
            <DetailFact
              label={tDetail("salesAccount")}
              value={detail.sales_account_code ?? t("notSet")}
            />
            <DetailFact
              label={tDetail("purchaseAccount")}
              value={detail.purchase_account_code ?? t("notSet")}
            />
            <DetailFact label={tDetail("taxCode")} value={detail.tax_code ?? t("notSet")} />
            <DetailFact
              label={tDetail("taxRate")}
              value={detail.tax_rate_percent == null ? t("notSet") : `${detail.tax_rate_percent}%`}
            />
            <DetailFact
              label={tDetail("dimensions")}
              value={formatDimensions(detail, t("notSet"))}
            />
            <DetailFact label={tDetail("weight")} value={formatWeight(detail, t("notSet"))} />
            <DetailFact
              label={tDetail("returnable")}
              value={detail.returnable ? t("yes") : t("no")}
            />
          </div>

          {simpleVariant ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailFact label={t("barcode")} value={simpleVariant.barcode ?? t("notSet")} />
              <DetailFact
                label={tDetail("purchase")}
                value={formatPrice(simpleVariant, "purchase_price", t("notSet"))}
              />
              <DetailFact
                label={tDetail("sales")}
                value={formatPrice(simpleVariant, "sales_price", t("notSet"))}
              />
              <DetailFact
                label={tDetail("reorderPoint")}
                value={
                  simpleVariant.reorder_point == null ? t("notSet") : simpleVariant.reorder_point
                }
              />
            </div>
          ) : null}
        </div>
      </section>

      {customFieldRows.length > 0 ? (
        <section className="rounded-md border p-3">
          <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
            {t("customFields")}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {customFieldRows.map(({ field, value }) => (
              <DetailFact key={field.id} label={field.name} value={value} />
            ))}
          </div>
        </section>
      ) : null}

      {detail.sales_description || detail.purchase_description ? (
        <section className="grid gap-3 md:grid-cols-2">
          <DescriptionBlock
            title={tDetail("salesDescription")}
            value={detail.sales_description}
            emptyLabel={t("notSet")}
          />
          <DescriptionBlock
            title={tDetail("purchaseDescription")}
            value={detail.purchase_description}
            emptyLabel={t("notSet")}
          />
        </section>
      ) : null}

      {hasVisibleVariants ? (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
            {t("variants")}
          </p>
          <div className="overflow-hidden rounded-md border">
            {detail.variants.map((variant) => {
              const variantImages = detail.images.filter(
                (image) => image.variant_id === variant.id
              );
              const variantCustomFieldRows = customFields
                .filter((field) => field.entity_type === "variant")
                .map((field) => ({ field, value: variant.custom_field_values[field.id] }))
                .filter((row) => row.value);
              const expanded = !!expandedVariantIds[variant.id];
              return (
                <div key={variant.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                    onClick={() =>
                      setExpandedVariantIds((current) => {
                        const next = { ...current };
                        if (next[variant.id]) delete next[variant.id];
                        else next[variant.id] = true;
                        return next;
                      })
                    }
                    aria-expanded={expanded}
                  >
                    <ProductImageThumb src={variant.thumbnail_url} className="h-9 w-9" />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{variant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {variant.sku}
                      </span>
                      <VariantOptionSummary variant={variant} className="mt-1" />
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden text-right text-xs text-muted-foreground sm:block">
                        {t("availableSuffix", {
                          quantity: variant.available_quantity,
                          unit: detail.unit_code,
                        })}
                      </span>
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                  {expanded ? (
                    <div className="grid gap-3 border-t bg-muted/20 p-3 md:grid-cols-[minmax(160px,220px)_1fr]">
                      <VariantImageGallery
                        images={variantImages}
                        fallback={variant.thumbnail_url}
                      />
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <DetailFact
                          label={tList("onHand")}
                          value={`${variant.on_hand_quantity} ${detail.unit_code}`}
                        />
                        <DetailFact
                          label={tList("available")}
                          value={`${variant.available_quantity} ${detail.unit_code}`}
                        />
                        <DetailFact
                          label={tDetail("reorderPoint")}
                          value={
                            variant.reorder_point == null ? t("notSet") : variant.reorder_point
                          }
                        />
                        <DetailFact label={t("status")} value={variant.status} />
                        <DetailFact label={t("barcode")} value={variant.barcode ?? t("notSet")} />
                        <DetailFact
                          label={tDetail("purchase")}
                          value={formatPrice(variant, "purchase_price", t("notSet"))}
                        />
                        <DetailFact
                          label={tDetail("sales")}
                          value={formatPrice(variant, "sales_price", t("notSet"))}
                        />
                        <DetailFact
                          label={t("attributes")}
                          value={
                            variant.option_values.length > 0
                              ? variant.option_values
                                  .map((option) => `${option.option_group_name}: ${option.value}`)
                                  .join(", ")
                              : t("notSet")
                          }
                        />
                        {variantCustomFieldRows.map(({ field, value }) => (
                          <DetailFact key={field.id} label={field.name} value={value} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="flex gap-2">
        <Button asChild size="sm">
          <Link
            href={{
              pathname: "/dashboard/warehouse/items/[productId]",
              params: { productId: detail.id },
            }}
          >
            {t("openProfile")}
          </Link>
        </Button>
        {canManageProducts ? (
          <Button asChild size="sm" variant="outline">
            <Link
              href={{
                pathname: "/dashboard/warehouse/items/[productId]/edit",
                params: { productId: detail.id },
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              {t("edit")}
            </Link>
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function ProductImageThumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden rounded border bg-muted",
        className
      )}
    >
      {src ? (
        <Image
          src={src}
          alt=""
          width={48}
          height={48}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <PackagePlus className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

function VariantImageGallery({
  images,
  fallback,
}: {
  images: InventoryProductImageRow[];
  fallback: string | null;
}) {
  const urls = images.map(imageUrl).filter((url): url is string => Boolean(url));
  const primary = urls[0] ?? fallback;

  return (
    <div className="space-y-2">
      <div className="grid aspect-square max-h-52 place-items-center overflow-hidden rounded-md border bg-background">
        {primary ? (
          <Image
            src={primary}
            alt=""
            width={220}
            height={220}
            unoptimized
            className="h-full w-full object-cover"
          />
        ) : (
          <PackagePlus className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      {urls.length > 1 ? (
        <div className="flex flex-wrap gap-1.5">
          {urls.slice(0, 8).map((url) => (
            <Image
              key={url}
              src={url}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 rounded border object-cover"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function VariantOptionSummary({
  variant,
  className,
}: {
  variant: InventoryProductVariantListRow;
  className?: string;
}) {
  const t = useTranslations("warehouseInventory.common");
  if (variant.option_values.length === 0) {
    return (
      <span className={cn("text-xs text-muted-foreground", className)}>{t("noAttributes")}</span>
    );
  }

  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {variant.option_values.map((option) => (
        <span
          key={`${variant.id}-${option.option_group_id}`}
          className="rounded border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground"
        >
          {option.option_group_name}: <span className="text-foreground">{option.value}</span>
        </span>
      ))}
    </span>
  );
}

function DetailFact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
      <p className="text-[11px] font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 truncate text-sm">{value}</div>
    </div>
  );
}

function TagChips({ tags, className }: { tags: string[]; className?: string }) {
  if (tags.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tags.map((tag) => (
        <Badge key={tag} variant="secondary" className="rounded-md text-xs">
          {tag}
        </Badge>
      ))}
    </div>
  );
}

function DescriptionBlock({
  title,
  value,
  emptyLabel,
}: {
  title: string;
  value: string | null;
  emptyLabel: string;
}) {
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{value ?? emptyLabel}</p>
    </div>
  );
}

function imageUrl(image: InventoryProductImageRow | undefined) {
  return image?.public_url ?? image?.storage_path ?? null;
}

function formatDimensions(detail: InventoryProductDetail, emptyLabel: string) {
  if (!detail.length_value && !detail.width_value && !detail.height_value) return emptyLabel;
  return `${detail.length_value ?? "-"} x ${detail.width_value ?? "-"} x ${detail.height_value ?? "-"} ${detail.dimension_unit ?? ""}`.trim();
}

function formatWeight(detail: InventoryProductDetail, emptyLabel: string) {
  if (!detail.weight_value) return emptyLabel;
  return `${detail.weight_value} ${detail.weight_unit ?? ""}`.trim();
}

function formatPrice(
  variant: InventoryProductVariantListRow,
  key: "purchase_price" | "sales_price",
  emptyLabel: string
) {
  const value = variant[key];
  if (value == null) return emptyLabel;
  return `${value} ${variant.price_currency ?? ""}`.trim();
}
