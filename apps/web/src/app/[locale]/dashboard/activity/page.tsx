import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { getPersonalActivityAction } from "@/app/actions/audit/get-personal-activity";
import { PersonalActivityWrapper } from "./_components/personal-activity-wrapper";

const DEFAULT_LIMIT = 50;

export default async function PersonalActivityPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId || !context.user.user?.id) {
    return redirect({ href: "/sign-in", locale });
  }

  const result = await getPersonalActivityAction(DEFAULT_LIMIT, 0);

  return (
    <PersonalActivityWrapper
      initialEvents={result.success ? result.data.events : []}
      initialTotal={result.success ? result.data.total : 0}
      limit={DEFAULT_LIMIT}
    />
  );
}
