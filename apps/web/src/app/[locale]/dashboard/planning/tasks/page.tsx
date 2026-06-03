import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_TASKS_READ,
  PLANNING_TASKS_CREATE,
  PLANNING_TASKS_ASSIGN,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { parseDataViewSearchParams } from "@/components/data-view/data-view-search-params";
import { TasksClient } from "./_components/tasks-client";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningTasksPage({ searchParams }: PageProps = {}) {
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

  const params = parseDataViewSearchParams(searchParams ? await searchParams : {});
  const supabase = await createClient();
  const orgId = context.app.activeOrgId;

  const [tasksResult, membersResult] = await Promise.all([
    PlanningTasksService.listForDataView(supabase, orgId, params),
    OrgMembersService.listMembers(supabase, orgId),
  ]);

  const initialData = tasksResult.success
    ? tasksResult.data
    : { rows: [], totalCount: 0, page: params.page, pageSize: params.pageSize };

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  const canCreate = checkPermission(context.user.permissionSnapshot, PLANNING_TASKS_CREATE);
  const canAssign = checkPermission(context.user.permissionSnapshot, PLANNING_TASKS_ASSIGN);

  return (
    <TasksClient
      initialData={initialData}
      canCreate={canCreate}
      canAssign={canAssign}
      members={members}
      orgId={orgId}
    />
  );
}
