import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_TASKS_READ,
  PLANNING_TASKS_CREATE,
  PLANNING_TASKS_UPDATE,
  PLANNING_TASKS_DELETE,
  PLANNING_TASKS_ASSIGN,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { PlanningSettingsService } from "@/server/services/planning-settings.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { taskKeys } from "../_components/tasks-query";
import { taskColumnSet } from "../_components/tasks-table";
import { TasksWorkspace } from "../_components/tasks-workspace";
import {
  loadTaskState,
  migrateTaskSearchParams,
  taskFilters,
  taskHref,
  taskListParams,
  TASK_PRIORITIES,
  TASK_STATUSES,
} from "../_components/tasks-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

const STATUS_KEY = {
  open: "open",
  in_progress: "inProgress",
  completed: "completed",
  cancelled: "cancelled",
} as const;

/**
 * Planning tasks (Kolor Sensu list, or the board): the view, the search, a
 * filter per column, the sort, the page and the open task in the address.
 * The server puts the first page (or the board) in the list's cache.
 */
export default async function PlanningTasksPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.planning"),
  ]);

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

  const path = getPathname({ locale, href: "/dashboard/planning/tasks" });
  const migration = migrateTaskSearchParams(searchParams ? await searchParams : {});
  const state = loadTaskState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(taskHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const board = state.widok === "tablica";

  const [listResult, boardResult, membersResult, settingsResult] = await Promise.all([
    board
      ? null
      : PlanningTasksService.listForDataView(
          supabase,
          orgId,
          taskListParams(state),
          taskFilters(state)
        ),
    board ? PlanningTasksService.listForKanban(supabase, orgId) : null,
    OrgMembersService.listMembers(supabase, orgId),
    PlanningSettingsService.getSettings(supabase, orgId),
  ]);

  if (listResult?.success) {
    const lastPage = Math.max(1, Math.ceil(listResult.data.totalCount / state.wierszy));
    if (state.strona > lastPage) {
      return redirectUrl(taskHref(path, state, { strona: lastPage }));
    }
  }

  // The first page (or the board) goes straight into the cache (no request
  // on the client); a failed read is left to the client, which retries.
  const queryClient = new QueryClient();
  if (listResult?.success) queryClient.setQueryData(taskKeys.list(orgId, state), listResult.data);
  if (boardResult?.success) queryClient.setQueryData(taskKeys.board(orgId), boardResult.data);

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  const snap = context.user.permissionSnapshot;
  const settings = settingsResult.success ? settingsResult.data : null;
  const statusConfigs = settings?.status_configs ?? null;
  const priorityConfigs = settings?.priority_configs ?? null;
  const pl = locale === "pl";

  const labels: Record<string, string> = {
    locale,
    title: t("pages.tasks.title"),
    column_task: pl ? "Zadanie" : "Task",
    column_status: t("tasks.status"),
    column_priority: t("tasks.priority"),
    column_assignee: t("tasks.assignee"),
    column_branch: pl ? "Oddział" : "Branch",
    column_due_at: t("tasks.due"),
    column_creator: t("tasks.createdBy"),
    column_created_at: t("tasks.created"),
    column_updated_at: t("tasks.updated"),
    unassigned: t("tasks.unassigned"),
    orgWide: t("tasks.organizationScope"),
    overdue: pl ? "Po terminie" : "Overdue",
    due_po_terminie: pl ? "Po terminie" : "Overdue",
    due_dzis: pl ? "Dziś" : "Today",
    due_7d: pl ? "Najbliższe 7 dni" : "Next 7 days",
    newTask: t("tasks.newTask"),
    listView: t("tasks.listView"),
    boardView: t("tasks.kanbanView"),
    emptyColumn: t("tasks.emptyColumn"),
    dragColumn: t("tasks.dragColumn"),
    viewFull: t("tasks.viewFull"),
    preview: pl ? "Podgląd" : "Preview",
    close: pl ? "Zamknij szczegóły" : "Close details",
    search: pl ? "Szukaj tytułu lub numeru…" : "Search title or number…",
    empty: pl
      ? "Brak zadań pasujących do wyszukiwania i filtrów."
      : "No tasks match the search and filters.",
    loadError: t("errors.loadFailed"),
    operationFailed: t("errors.operationFailed"),
    notFound: pl ? "Zadanie nie istnieje lub nie jest dostępne." : "Task not found or unavailable.",
    retry: t("errors.tryAgain"),
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "zadań" : "tasks",
  };
  for (const status of TASK_STATUSES) {
    labels[`status_${status}`] = statusConfigs?.[status]?.label ?? t(`tasks.${STATUS_KEY[status]}`);
  }
  for (const priority of TASK_PRIORITIES) {
    labels[`priority_${priority}`] = priorityConfigs?.[priority]?.label ?? t(`tasks.${priority}`);
  }

  const set = taskColumnSet(labels);
  const cookie = `ambra_planning_tasks_${context.user.user.id}_${orgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  const taskPathTemplate = getPathname({
    locale,
    href: { pathname: "/dashboard/planning/tasks/[taskId]", params: { taskId: "__TASK__" } },
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TasksWorkspace
        orgId={orgId}
        path={path}
        set={set}
        layout={layout}
        widths={widths}
        cookie={cookie}
        labels={labels}
        configs={{ status: statusConfigs, priority: priorityConfigs }}
        members={members}
        branches={context.app.accessibleBranches.map((branch) => ({
          id: branch.id,
          name: branch.name,
        }))}
        activeBranchId={context.app.activeBranchId}
        currentUserId={context.user.user?.id ?? ""}
        canCreate={checkPermission(snap, PLANNING_TASKS_CREATE)}
        canUpdate={checkPermission(snap, PLANNING_TASKS_UPDATE)}
        canAssign={checkPermission(snap, PLANNING_TASKS_ASSIGN)}
        canDelete={checkPermission(snap, PLANNING_TASKS_DELETE)}
        taskPathTemplate={taskPathTemplate}
      />
    </HydrationBoundary>
  );
}
