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
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";

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
  const productResult = await InventoryProductsService.getProductDetail(
    supabase,
    context.app.activeOrgId,
    productId
  );
  if (!productResult.success || !productResult.data) notFound();
  const product = productResult.data;
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

      <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="grid gap-3">
          <div className="grid aspect-square place-items-center rounded-md border bg-muted/30">
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
            <div className="grid grid-cols-5 gap-2">
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

        <div className="grid gap-4">
          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-3">
            <Info label="Status" value={<Badge>{product.status}</Badge>} />
            <Info label="Type" value={product.product_type.replace("_", " ")} />
            <Info label="Unit" value={product.unit_code} />
            <Info label="On hand" value={`${product.on_hand_quantity} ${product.unit_code}`} />
            <Info label="Available" value={`${product.available_quantity} ${product.unit_code}`} />
            <Info
              label="Variants"
              value={hasVisibleVariants ? String(product.variant_count) : "Simple item"}
            />
          </div>

          <div className="grid gap-3 rounded-md border p-4 sm:grid-cols-2">
            <Info label="Brand" value={product.brand_name ?? "Not set"} />
            <Info label="Manufacturer" value={product.manufacturer_name ?? "Not set"} />
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
          </div>
        </div>
      </section>

      {hasVisibleVariants ? (
        <section className="grid gap-4 rounded-md border p-4">
          <h2 className="text-lg font-medium">Variants</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 text-left">Variant</th>
                  <th className="py-2 text-left">SKU</th>
                  <th className="py-2 text-right">On hand</th>
                  <th className="py-2 text-right">Available</th>
                  <th className="py-2 text-right">Reorder</th>
                  <th className="py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => (
                  <tr key={variant.id} className="border-b last:border-b-0">
                    <td className="py-2">{variant.name}</td>
                    <td className="py-2">{variant.sku}</td>
                    <td className="py-2 text-right tabular-nums">{variant.on_hand_quantity}</td>
                    <td className="py-2 text-right tabular-nums">{variant.available_quantity}</td>
                    <td className="py-2 text-right tabular-nums">{variant.reorder_point ?? "-"}</td>
                    <td className="py-2">{variant.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-md border p-4">
        <h2 className="text-lg font-medium">Unit conversions</h2>
        {product.unit_conversions.length > 0 ? (
          <div className="grid gap-2">
            {product.unit_conversions.map((conversion) => (
              <div key={conversion.id} className="rounded-md bg-muted/30 px-3 py-2 text-sm">
                {conversion.from_unit_id} {"->"} {conversion.to_unit_id}: {conversion.factor}
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
