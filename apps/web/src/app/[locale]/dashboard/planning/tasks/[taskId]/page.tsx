import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_BOARDS_UPDATE,
  PLANNING_TASKS_ASSIGN,
  PLANNING_TASKS_DELETE,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { TaskEditor } from "@/components/planning/task-editor";

type PageProps = {
  params: Promise<{ taskId: string }>;
};

/** A task on its own page: the same editor as on the boards, the list and the calendar. */
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
  const userId = context.user.user?.id ?? "";

  const [taskResult, membersResult] = await Promise.all([
    KanbanBoardsService.getTaskEditor(supabase, orgId, userId, taskNumber),
    OrgMembersService.listMembers(supabase, orgId),
  ]);

  if (!taskResult.success || !taskResult.data) {
    notFound();
  }

  const people = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  const snap = context.user.permissionSnapshot;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background">
      <TaskEditor
        orgId={orgId}
        taskRef={taskNumber}
        initialData={taskResult.data}
        people={people}
        currentUserId={userId}
        canUpdate={checkPermission(snap, PLANNING_TASKS_UPDATE)}
        canAssign={checkPermission(snap, PLANNING_TASKS_ASSIGN)}
        canArchive={checkPermission(snap, PLANNING_TASKS_DELETE)}
        canMove={checkPermission(snap, PLANNING_BOARDS_UPDATE)}
        showOpenFull={false}
      />
    </div>
  );
}
