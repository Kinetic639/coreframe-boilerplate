import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgRolesService } from "@/server/services/organization.service";
import { RolesClient } from "./_components/roles-client";

export default async function RolesPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
      locale,
    });
  }

  const supabase = await createClient();
  const rolesResult = await OrgRolesService.listRoles(supabase, context.app.activeOrgId);

  return <RolesClient initialRoles={rolesResult.success ? rolesResult.data : []} />;
}
