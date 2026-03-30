import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { entitlements } from "@/server/guards/entitlements-guards";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";

/**
 * Warehouse module layout.
 *
 * Gate 1 (plan-level): org must have MODULE_WAREHOUSE in enabled_modules.
 * Gate 2 (auth): user must be authenticated.
 *
 * NOTE (skeleton): No user-level permission check yet.
 * Warehouse-specific permissions (warehouse.read, etc.) will be added
 * when the permission family is introduced in a later implementation slice.
 */
export default async function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  // Gate 1: plan must include the warehouse module
  await entitlements.requireModuleOrRedirect(MODULE_WAREHOUSE);

  // Gate 2: user must be authenticated
  const context = await loadDashboardContextV2();
  if (!context) return redirect({ href: "/sign-in", locale });

  return <>{children}</>;
}
