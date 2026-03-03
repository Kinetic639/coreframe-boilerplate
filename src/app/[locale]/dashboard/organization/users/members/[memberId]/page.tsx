import { redirect } from "@/i18n/navigation";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  OrgMembersService,
  OrgRolesService,
  OrgBranchesService,
} from "@/server/services/organization.service";
import { MemberDetailClient } from "./_components/member-detail-client";

interface MemberDetailPageProps {
  params: Promise<{ memberId: string }>;
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const locale = await getLocale();
  const { memberId } = await params;
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [memberResult, accessResult, rolesResult, branchesResult] = await Promise.all([
    OrgMembersService.getMember(supabase, orgId, memberId),
    OrgRolesService.getMemberAccess(supabase, orgId, memberId),
    OrgRolesService.listRoles(supabase, orgId),
    OrgBranchesService.listBranches(supabase, orgId),
  ]);

  if (!memberResult.success) return notFound();

  return (
    <MemberDetailClient
      member={memberResult.data}
      initialAccess={
        accessResult.success ? accessResult.data : { user_id: memberId, assignments: [] }
      }
      initialRoles={rolesResult.success ? rolesResult.data : []}
      initialBranches={branchesResult.success ? branchesResult.data : []}
    />
  );
}
