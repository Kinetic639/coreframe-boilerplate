import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_READ } from "@/lib/constants/permissions";

/** Organization → QR codes: needs qr.read (owners and members by default). */
export default async function QrCodesRegistryLayout({ children }: { children: React.ReactNode }) {
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
