import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ, BRANCH_ROLES_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgMembersService, OrgRolesService } from "@/server/services/organization.service";
import { BranchAccessClient } from "./_components/branch-access-client";

export default async function BranchAccessPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const canRead = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
  const canBranchManage = checkPermission(context.user.permissionSnapshot, BRANCH_ROLES_MANAGE);

  if (!canRead && !canBranchManage) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "branch_roles_manage_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [groupedResult, rolesResult] = await Promise.all([
    OrgMembersService.getMembersGroupedByBranch(supabase, orgId),
    OrgRolesService.listRoles(supabase, orgId),
  ]);

  // Branch managers only see branch-scoped roles in the assignment dialog
  const allRoles = rolesResult.success ? rolesResult.data : [];
  const availableRoles = canRead ? allRoles : allRoles.filter((r) => r.scope_type === "branch");

  // Branch managers only see branches they can manage (accessibleBranches)
  const accessibleBranchIds = canRead
    ? null // null means "all branches" for org admins
    : new Set(context.app.accessibleBranches.map((b) => b.id));

  const groups = groupedResult.success ? groupedResult.data : [];
  const visibleGroups =
    accessibleBranchIds === null
      ? groups
      : groups.filter((g) => g.branchId !== null && accessibleBranchIds.has(g.branchId));

  return (
    <BranchAccessClient
      initialGroups={visibleGroups}
      availableRoles={availableRoles}
      canOrgAdmin={canRead}
    />
  );
}
