import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { WAREHOUSE_PRODUCTS_READ, WAREHOUSE_READ } from "@/lib/constants/permissions";
import { checkPermission } from "@/lib/utils/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";

export default async function WarehouseItemCustomFieldsPage() {
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

  return redirect({ href: "/dashboard/warehouse/settings", locale });
}
