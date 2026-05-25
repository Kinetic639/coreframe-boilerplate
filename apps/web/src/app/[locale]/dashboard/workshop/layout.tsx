import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { entitlements } from "@/server/guards/entitlements-guards";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MODULE_WORKSHOP } from "@/lib/constants/modules";
import { MODULE_WORKSHOP_ACCESS } from "@/lib/constants/permissions";

export default async function WorkshopLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  // Gate 1: org must be entitled to the Workshop module (plan-level — Professional/Enterprise)
  await entitlements.requireModuleOrRedirect(MODULE_WORKSHOP);

  // Gate 2: user must have module access permission (user-level)
  const context = await loadDashboardContextV2();
  if (!context) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, MODULE_WORKSHOP_ACCESS)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "module_access", module: "workshop" },
      },
      locale,
    });
  }

  return <>{children}</>;
}
