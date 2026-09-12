import { redirect } from "@/i18n/navigation";
import { redirect as redirectToPath } from "next/navigation";
import { checkPermission } from "@/lib/utils/permissions";
import {
  QR_ASSIGN,
  HELPDESK_TICKETS_CREATE,
  PLANNING_TASKS_CREATE,
  PLANNING_TASKS_ASSIGN,
} from "@/lib/constants/permissions";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { createClient } from "@/utils/supabase/server";
import { getQrCodeByTokenAction } from "@/app/actions/qr/assign";
import { resolvePublicQrToken } from "@/server/qr/public-token-resolver";
import { OrgMembersService } from "@/server/services/organization.service";
import { PlanningSettingsService } from "@/server/services/planning-settings.service";
import { QuickAssignWizard } from "./_components/quick-assign-wizard";

interface PageProps {
  params: Promise<{ token: string; locale: string }>;
}

export default async function QuickAssignQrPage({ params }: PageProps) {
  const { token, locale } = await params;
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, QR_ASSIGN)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "qr_assign_required" } },
      locale,
    });
  }

  const lookup = await getQrCodeByTokenAction(token);

  if (!lookup.success || !lookup.data) {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">QR code not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This QR code doesn&apos;t exist in your organization.
        </p>
      </div>
    );
  }

  if (lookup.data.status !== "active") {
    return (
      <div className="mx-auto max-w-md p-8 text-center">
        <h1 className="text-lg font-semibold">QR code revoked</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This QR code has been revoked and can no longer be assigned.
        </p>
      </div>
    );
  }

  if (lookup.data.assignment) {
    // Race: someone else assigned it between scan and click — go to the target.
    const resolved = await resolvePublicQrToken(token, { locale });
    if (resolved.ok) return redirectToPath(resolved.redirectPath);
  }

  const snap = context.user.permissionSnapshot;
  const orgId = context.app.activeOrgId;
  const supabase = await createClient();

  const [membersResult, planningSettingsResult] = await Promise.all([
    OrgMembersService.listMembers(supabase, orgId),
    PlanningSettingsService.getSettings(supabase, orgId),
  ]);

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
        avatar_url: m.user_avatar_url ?? null,
      }))
    : [];
  const planningSettings = planningSettingsResult.success ? planningSettingsResult.data : null;

  return (
    <QuickAssignWizard
      qrCodeId={lookup.data.id}
      token={lookup.data.token}
      label={lookup.data.label}
      orgId={orgId}
      canCreateTicket={checkPermission(snap, HELPDESK_TICKETS_CREATE)}
      canCreateTask={checkPermission(snap, PLANNING_TASKS_CREATE)}
      canAssignTask={checkPermission(snap, PLANNING_TASKS_ASSIGN)}
      members={members}
      branches={context.app.accessibleBranches.map((branch) => ({
        id: branch.id,
        name: branch.name,
      }))}
      activeBranchId={context.app.activeBranchId}
      currentUserId={context.user.user?.id ?? ""}
      taskPriorityConfigs={planningSettings?.priority_configs ?? null}
    />
  );
}
