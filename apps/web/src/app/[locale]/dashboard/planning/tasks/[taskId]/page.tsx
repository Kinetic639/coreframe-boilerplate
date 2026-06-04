import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_TASKS_ASSIGN,
  PLANNING_TASKS_DELETE,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { PlanningSettingsService } from "@/server/services/planning-settings.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { getQrAssignmentForTaskAction } from "@/app/actions/planning";
import { PlanningTaskDetailPanel } from "../_components/planning-task-detail-panel";

type PageProps = {
  params: Promise<{ taskId: string }>;
};

export default async function PlanningTaskDetailPage({ params }: PageProps) {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_TASKS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_tasks_read_required" },
      },
      locale,
    });
  }

  const { taskId: taskNumber } = await params;
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [taskResult, membersResult, settingsResult] = await Promise.all([
    PlanningTasksService.getDetail(supabase, orgId, taskNumber),
    OrgMembersService.listMembers(supabase, orgId),
    PlanningSettingsService.getSettings(supabase, orgId),
  ]);

  if (!taskResult.success || !taskResult.data) {
    notFound();
  }

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  const snap = context.user.permissionSnapshot;
  const settings = settingsResult.success ? settingsResult.data : null;
  const qrAssignmentResult = taskResult.success
    ? await getQrAssignmentForTaskAction(taskResult.data.id)
    : { success: true as const, data: null };

  return (
    <div className="h-full min-h-0">
      <PlanningTaskDetailPanel
        detail={taskResult.data}
        canUpdate={checkPermission(snap, PLANNING_TASKS_UPDATE)}
        canAssign={checkPermission(snap, PLANNING_TASKS_ASSIGN)}
        canDelete={checkPermission(snap, PLANNING_TASKS_DELETE)}
        members={members}
        initialQrAssignment={qrAssignmentResult.success ? qrAssignmentResult.data : null}
        showFullLink={false}
        statusConfigs={settings?.status_configs ?? null}
        priorityConfigs={settings?.priority_configs ?? null}
      />
    </div>
  );
}
