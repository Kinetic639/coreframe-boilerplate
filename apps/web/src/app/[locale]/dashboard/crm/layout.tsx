import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { entitlements } from "@/server/guards/entitlements-guards";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MODULE_CRM } from "@/lib/constants/modules";
import { MODULE_CRM_ACCESS } from "@/lib/constants/permissions";

export default async function CrmLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  await entitlements.requireModuleOrRedirect(MODULE_CRM);

  const context = await loadDashboardContextV2();
  if (!context) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MODULE_CRM_ACCESS)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "module_access", module: "crm" },
      },
      locale,
    });
  }

  return <>{children}</>;
}
