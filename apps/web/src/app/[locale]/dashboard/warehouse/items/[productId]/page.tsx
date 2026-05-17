import Image from "next/image";
import type React from "react";
import { notFound } from "next/navigation";
import { ArrowLeft, Edit, PackagePlus } from "lucide-react";
import { redirect, Link } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import {
  InventoryProductsService,
  type InventoryCustomFieldDefinition,
  type InventoryProductImageRow,
  type InventoryProductVariantListRow,
} from "@/server/services/inventory-products.service";

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function WarehouseItemDetailPage({ params }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  const { productId } = await params;

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
  ) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_products_read" } },
      locale,
    });
  }

  const supabase = await createClient();
  const [productResult, customFieldsResult] = await Promise.all([
    InventoryProductsService.getProductDetail(supabase, context.app.activeOrgId, productId),
    InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId),
  ]);
  if (!productResult.success || !productResult.data) notFound();
  const product = productResult.data;
  const customFields = customFieldsResult.success ? customFieldsResult.data : [];
  const productCustomFieldRows = customFields
    .filter((field) => field.entity_type === "product")
    .map((field) => ({ field, value: product.custom_field_values[field.id] }))
    .filter((row) => row.value);
  const productImages = product.images.filter((image) => !image.variant_id);
  const canManage = checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE);
  const hasVisibleVariants = product.variant_count > 1;

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Button asChild type="button" variant="ghost" size="sm">
              <Link href="/dashboard/warehouse/items">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Products
              </Link>
            </Button>
          </div>
          <h1 className="text-2xl font-semibold">{product.name}</h1>
          <p className="text-sm text-muted-foreground">
            {hasVisibleVariants ? `${product.variant_count} variants` : product.sku}
          </p>
        </div>
        {canManage ? (
          <Button asChild>
            <Link
              href={{
                pathname: "/dashboard/warehouse/items/[productId]/edit",
                params: { productId: product.id },
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Link>
          </Button>
        ) : null}
      </div>

      <section className="grid items-start gap-4 lg:grid-cols-[minmax(220px,320px)_minmax(0,1fr)]">
        <div className="grid min-w-0 gap-3">
          <div className="grid aspect-square max-h-80 place-items-center overflow-hidden rounded-md border bg-muted/30">
            {product.thumbnail_url ? (
              <Image
                src={product.thumbnail_url}
                alt=""
                width={320}
                height={320}
                unoptimized
                className="h-full w-full rounded-md object-cover"
              />
            ) : (
              <PackagePlus className="h-10 w-10 text-muted-foreground" />
            )}
          </div>
          {productImages.length > 1 ? (
            <div className="flex flex-wrap gap-2">
              {productImages.map((image) => {
                const url = image.public_url ?? image.storage_path;
                return url ? (
                  <Image
                    key={image.id}
                    src={url}
                    alt=""
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded-md border object-cover"
                  />
                ) : null;
              })}
            </div>
          ) : null}
        </div>

        <div className="grid min-w-0 gap-4">
          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
            <Info label="Status" value={<Badge>{product.status}</Badge>} />
            <Info label="Type" value={product.product_type.replace("_", " ")} />
            <Info label="Unit" value={product.unit_code} />
            <Info label="On hand" value={`${product.on_hand_quantity} ${product.unit_code}`} />
            <Info label="Available" value={`${product.available_quantity} ${product.unit_code}`} />
            {hasVisibleVariants ? <Info label="Variants" value={product.variant_count} /> : null}
          </div>

          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
            <Info label="Brand" value={product.brand_name ?? "Not set"} />
            <Info label="Manufacturer" value={product.manufacturer_name ?? "Not set"} />
            <Info label="Sales account" value={product.sales_account_code ?? "Not set"} />
            <Info label="Purchase account" value={product.purchase_account_code ?? "Not set"} />
            <Info label="Tax code" value={product.tax_code ?? "Not set"} />
            <Info
              label="Tax rate"
              value={product.tax_rate_percent == null ? "Not set" : `${product.tax_rate_percent}%`}
            />
            <Info
              label="Dimensions"
              value={
                product.length_value || product.width_value || product.height_value
                  ? `${product.length_value ?? "-"} x ${product.width_value ?? "-"} x ${product.height_value ?? "-"} ${product.dimension_unit ?? ""}`
                  : "Not set"
              }
            />
            <Info
              label="Weight"
              value={
                product.weight_value
                  ? `${product.weight_value} ${product.weight_unit ?? ""}`
                  : "Not set"
              }
            />
          </div>

          <div className="rounded-md border p-4">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Description
            </p>
            <p className="text-sm">{product.description ?? "No description"}</p>
            {product.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {product.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="rounded-md text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          {productCustomFieldRows.length > 0 ? (
            <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
              {productCustomFieldRows.map(({ field, value }) => (
                <Info key={field.id} label={field.name} value={value} />
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {hasVisibleVariants ? (
        <section className="grid gap-4 rounded-md border p-4">
          <h2 className="text-lg font-medium">Variants</h2>
          <div className="overflow-hidden rounded-md border">
            {product.variants.map((variant) => (
              <VariantProfileRow
                key={variant.id}
                variant={variant}
                images={product.images.filter((image) => image.variant_id === variant.id)}
                customFields={customFields}
                unitCode={product.unit_code}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-md border p-4">
        <h2 className="text-lg font-medium">Unit conversions</h2>
        {product.unit_conversions.length > 0 ? (
          <div className="grid gap-2">
            {product.unit_conversions.map((conversion) => (
              <div key={conversion.id} className="rounded-md bg-muted/30 px-3 py-2 text-sm">
                1 {conversion.from_unit_code || conversion.from_unit_id} = {conversion.factor}{" "}
                {conversion.to_unit_code || conversion.to_unit_id}
                <span className="ml-2 text-xs text-muted-foreground">
                  {conversion.rounding_mode.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No product-specific conversions.</p>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}

function VariantProfileRow({
  variant,
  images,
  customFields,
  unitCode,
}: {
  variant: InventoryProductVariantListRow;
  images: InventoryProductImageRow[];
  customFields: InventoryCustomFieldDefinition[];
  unitCode: string;
}) {
  const customFieldRows = customFields
    .filter((field) => field.entity_type === "variant")
    .map((field) => ({ field, value: variant.custom_field_values[field.id] }))
    .filter((row) => row.value);
  return (
    <details className="group border-b last:border-b-0">
      <summary className="grid cursor-pointer list-none grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-3 text-sm hover:bg-muted/40">
        <VariantThumb src={variant.thumbnail_url} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{variant.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{variant.sku}</span>
          <VariantOptions variant={variant} className="mt-1" />
        </span>
        <span className="text-right text-xs text-muted-foreground">
          {variant.available_quantity} {unitCode} available
        </span>
      </summary>
      <div className="grid gap-4 border-t bg-muted/20 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <VariantGallery images={images} fallback={variant.thumbnail_url} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="On hand" value={`${variant.on_hand_quantity} ${unitCode}`} />
          <Info label="Available" value={`${variant.available_quantity} ${unitCode}`} />
          <Info label="Reorder" value={variant.reorder_point ?? "Not set"} />
          <Info label="Status" value={variant.status} />
          <Info label="Barcode" value={variant.barcode ?? "Not set"} />
          <Info label="Purchase" value={formatVariantPrice(variant, "purchase_price")} />
          <Info label="Sales" value={formatVariantPrice(variant, "sales_price")} />
          <Info
            label="Attributes"
            value={
              variant.option_values.length > 0
                ? variant.option_values
                    .map((option) => `${option.option_group_name}: ${option.value}`)
                    .join(", ")
                : "Not set"
            }
          />
          {customFieldRows.map(({ field, value }) => (
            <Info key={field.id} label={field.name} value={value} />
          ))}
        </div>
      </div>
    </details>
  );
}

function VariantThumb({ src }: { src: string | null }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded border bg-muted">
      {src ? (
        <Image
          src={src}
          alt=""
          width={40}
          height={40}
          unoptimized
          className="h-full w-full object-cover"
        />
      ) : (
        <PackagePlus className="h-4 w-4 text-muted-foreground" />
      )}
    </span>
  );
}

function VariantOptions({
  variant,
  className,
}: {
  variant: InventoryProductVariantListRow;
  className?: string;
}) {
  if (variant.option_values.length === 0) {
    return <span className={cn("text-xs text-muted-foreground", className)}>No attributes</span>;
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

function VariantGallery({
  images,
  fallback,
}: {
  images: InventoryProductImageRow[];
  fallback: string | null;
}) {
  const urls = images
    .map((image) => image.public_url ?? image.storage_path)
    .filter((url): url is string => Boolean(url));
  const primary = urls[0] ?? fallback;

  return (
    <div className="grid gap-2">
      <div className="grid aspect-square max-h-56 place-items-center overflow-hidden rounded-md border bg-background">
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

function formatVariantPrice(
  variant: InventoryProductVariantListRow,
  key: "purchase_price" | "sales_price"
) {
  const value = variant[key];
  if (value == null) return "Not set";
  return `${value} ${variant.price_currency ?? ""}`.trim();
}
