import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_READ } from "@/lib/constants/permissions";

/**
 * QR Codes module layout.
 *
 * Always available — no plan entitlement required.
 * Gate: user must have qr.read (granted to org_owner + org_member by default).
 */
export default async function QrLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, QR_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "qr_read_required" } },
      locale,
    });
  }

  return <>{children}</>;
}
