import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ORG_UPDATE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgBillingService } from "@/server/services/organization.service";
import { BillingClient } from "./_components/billing-client";

export default async function BillingPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, ORG_UPDATE)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const t = await getTranslations("organization.billing");

  const supabase = await createClient();
  const billingResult = await OrgBillingService.getBillingOverview(
    supabase,
    context.app.activeOrgId
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <BillingClient initialBilling={billingResult.success ? billingResult.data : null} />
    </div>
  );
}
