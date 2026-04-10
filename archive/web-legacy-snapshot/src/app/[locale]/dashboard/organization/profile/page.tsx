import { redirect } from "@/i18n/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { ORG_READ, ORG_UPDATE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgProfileService } from "@/server/services/organization.service";
import { OrgProfileClient } from "./_components/org-profile-client";

export default async function OrgProfilePage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, ORG_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  const t = await getTranslations("modules.organizationManagement");

  const supabase = await createClient();
  const profileResult = await OrgProfileService.getProfile(supabase, context.app.activeOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("items.profile")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <OrgProfileClient
        canEdit={checkPermission(context.user.permissionSnapshot, ORG_UPDATE)}
        initialProfile={profileResult.success ? profileResult.data : null}
      />
    </div>
  );
}
