import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { AUDIT_EVENTS_READ } from "@/lib/constants/permissions";
import { getAuditFeedAction } from "@/app/actions/audit/get-audit-feed";
import { AuditFeedWrapper } from "./_components/audit-feed-wrapper";

const DEFAULT_LIMIT = 50;

export default async function AuditFeedPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, AUDIT_EVENTS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "audit_read_required" },
      },
      locale,
    });
  }

  const result = await getAuditFeedAction(DEFAULT_LIMIT, 0);

  return (
    <AuditFeedWrapper
      initialEvents={result.success ? result.data.events : []}
      initialTotal={result.success ? result.data.total : 0}
      limit={DEFAULT_LIMIT}
    />
  );
}
