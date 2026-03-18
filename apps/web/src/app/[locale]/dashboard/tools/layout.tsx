import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { PERMISSION_TOOLS_READ } from "@/lib/constants/permissions";

/**
 * Tools module layout.
 *
 * Tools is ALWAYS AVAILABLE — no plan entitlement check.
 * Security gate: user must have tools.read permission (granted to org_owner + org_member).
 */
export default async function ToolsLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, PERMISSION_TOOLS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "tools_read_required" },
      },
      locale,
    });
  }

  return <>{children}</>;
}
