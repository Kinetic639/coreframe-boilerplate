import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { NotificationsPageClient } from "./_components/notifications-page-client";

/** /dashboard/powiadomienia — every notification of the user in the active organization */
export default async function NotificationsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  return <NotificationsPageClient orgId={context.app.activeOrgId} />;
}
