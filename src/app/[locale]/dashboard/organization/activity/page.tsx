import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ORG_READ } from "@/lib/constants/permissions";
import { getOrgActivityAction } from "@/app/actions/audit/get-org-activity";
import { OrgActivityWrapper } from "./_components/org-activity-wrapper";

const DEFAULT_LIMIT = 50;

export default async function OrgActivityPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, ORG_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "org_read_required" } },
      locale,
    });
  }

  const result = await getOrgActivityAction(DEFAULT_LIMIT, 0);

  return (
    <OrgActivityWrapper
      initialEvents={result.success ? result.data.events : []}
      initialTotal={result.success ? result.data.total : 0}
      limit={DEFAULT_LIMIT}
    />
  );
}
