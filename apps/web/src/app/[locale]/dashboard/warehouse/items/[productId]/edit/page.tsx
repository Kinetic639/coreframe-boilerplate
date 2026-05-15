import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_PRODUCTS_MANAGE,
  WAREHOUSE_PRODUCTS_READ,
  WAREHOUSE_READ,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { InventoryProductsService } from "@/server/services/inventory-products.service";
import { InventoryProductEditClient } from "./_components/inventory-product-edit-client";

type PageProps = {
  params: Promise<{ productId: string }>;
};

export default async function WarehouseEditItemPage({ params }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  const { productId } = await params;

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE)
  ) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "warehouse_products_manage" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const [productResult, unitsResult, suppliersResult, brandsResult, manufacturersResult] =
    await Promise.all([
      InventoryProductsService.getProductDetail(supabase, context.app.activeOrgId, productId),
      InventoryProductsService.listUnits(supabase, context.app.activeOrgId),
      InventoryProductsService.listSuppliers(supabase, context.app.activeOrgId),
      InventoryProductsService.listBrands(supabase, context.app.activeOrgId),
      InventoryProductsService.listManufacturers(supabase, context.app.activeOrgId),
    ]);

  if (!productResult.success || !productResult.data) notFound();

  return (
    <InventoryProductEditClient
      product={productResult.data}
      units={unitsResult.success ? unitsResult.data : []}
      suppliers={suppliersResult.success ? suppliersResult.data : []}
      brands={brandsResult.success ? brandsResult.data : []}
      manufacturers={manufacturersResult.success ? manufacturersResult.data : []}
    />
  );
}
