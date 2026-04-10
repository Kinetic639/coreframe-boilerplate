import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { entitlements } from "@/server/guards/entitlements-guards";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import { MODULE_WAREHOUSE_ACCESS } from "@/lib/constants/permissions";

/**
 * Warehouse module layout.
 *
 * Gate 1 (plan-level):   org must have MODULE_WAREHOUSE in enabled_modules.
 * Gate 2 (user-level):   user must have MODULE_WAREHOUSE_ACCESS permission.
 *
 * Mirrors the dual-gate pattern established in organization/layout.tsx.
 */
export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  // Gate 1: org plan must include the warehouse module
  await entitlements.requireModuleOrRedirect(MODULE_WAREHOUSE);

  // Gate 2: user must be authenticated and have warehouse module access
  const context = await loadDashboardContextV2();
  if (!context) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MODULE_WAREHOUSE_ACCESS)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "module_access", module: "warehouse" },
      },
      locale,
    });
  }

  return <>{children}</>;
}
