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
import { WarehouseInventorySettingsClient } from "./warehouse-inventory-settings-client";

export default async function WarehouseSettingsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ) ||
    !checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_READ)
  ) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "warehouse_settings_read" } },
      locale,
    });
  }

  const supabase = await createClient();
  const [unitsResult, conversionsResult, customFieldsResult, taxRatesResult, tagsResult] =
    await Promise.all([
      InventoryProductsService.listUnits(supabase, context.app.activeOrgId),
      InventoryProductsService.listUnitConversions(supabase, context.app.activeOrgId),
      InventoryProductsService.listCustomFields(supabase, context.app.activeOrgId),
      InventoryProductsService.listTaxRates(supabase, context.app.activeOrgId),
      InventoryProductsService.listTags(supabase, context.app.activeOrgId),
    ]);

  return (
    <WarehouseInventorySettingsClient
      units={unitsResult.success ? unitsResult.data : []}
      unitConversions={conversionsResult.success ? conversionsResult.data : []}
      customFields={customFieldsResult.success ? customFieldsResult.data : []}
      taxRates={taxRatesResult.success ? taxRatesResult.data : []}
      tags={tagsResult.success ? tagsResult.data : []}
      canManage={checkPermission(context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE)}
    />
  );
}
