import "server-only";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { loadUserContextV2 } from "@/server/loaders/v2/load-user-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import {
  HelpdeskTicketsService,
  type HelpdeskTicketListRow,
} from "@/server/services/helpdesk-tickets.service";
import {
  HelpdeskTicketTypesService,
  type HelpdeskBadgeConfig,
} from "@/server/services/helpdesk-ticket-types.service";
import { PlanningTasksService } from "@/server/services/planning-tasks.service";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { getPlanningCalendarDataAction } from "@/app/actions/planning/calendar";
import { isoToDateOnlyInTimeZone } from "@/lib/planning/calendar-dates";
import { checkPermission } from "@/lib/utils/permissions";
import { PLANNING_BOARDS_READ } from "@/lib/constants/permissions";
import { getPersonalActivityAction } from "@/app/actions/audit/get-personal-activity";
import { createClient } from "@/utils/supabase/server";
import type { PaginatedResult } from "@/lib/data-view/types";
import { attentionFilters, getHomeActions, readWidget } from "./model";
import type { HomePlanningSummary } from "./model";

type AttentionData = PaginatedResult<HelpdeskTicketListRow> & {
  priorityConfigs: Record<string, HelpdeskBadgeConfig> | null;
};

/** URL scope is only a selector; accessibleBranches and a fresh snapshot authorize it. */
export async function loadHomeContext(requestedBranch?: string) {
  const context = await loadDashboardContextV2();
  if (!context) return null;
  const { app } = context;
  const branch =
    app.accessibleBranches.find(
      (b) => b.id === requestedBranch && b.organization_id === app.activeOrgId
    ) ?? app.activeBranch;
  const [user, entitlement] = await Promise.all([
    branch?.id !== app.activeBranchId
      ? loadUserContextV2(app.activeOrgId, branch?.id ?? null)
      : Promise.resolve(context.user),
    app.activeOrgId
      ? EntitlementsService.loadEntitlements(app.activeOrgId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const actions =
    user && app.activeOrgId
      ? getHomeActions(user.permissionSnapshot, entitlement?.enabled_modules ?? [], Boolean(branch))
      : [];
  return {
    orgId: app.activeOrgId,
    orgName: app.activeOrg
      ? [app.activeOrg.name, app.activeOrg.name_2].filter(Boolean).join(" ")
      : null,
    branchId: branch?.id ?? null,
    branchName: branch?.name ?? null,
    actions,
  };
}
export async function loadAttention(orgId: string, branchId: string) {
  return readWidget<AttentionData>(async () => {
    const supabase = await createClient();
    const [tickets, settings] = await Promise.all([
      HelpdeskTicketsService.listForDataView(supabase, orgId, {
        page: 1,
        pageSize: 5,
        search: "",
        sort: { field: "updated_at", direction: "desc" },
        filters: attentionFilters(branchId),
      }),
      HelpdeskTicketTypesService.getSettings(supabase, orgId).catch(() => null),
    ]);

    if ("error" in tickets) return { success: false, error: tickets.error };
    return {
      success: true as const,
      data: {
        ...tickets.data,
        priorityConfigs: settings?.success && settings.data ? settings.data.priority_configs : null,
      },
    };
  });
}
export async function loadHomeActivity() {
  return readWidget(() => getPersonalActivityAction(10, 0));
}

export async function loadOpenTaskCount(orgId: string, branchId: string) {
  return readWidget(async () => {
    const result = await PlanningTasksService.listForDataView(
      await createClient(),
      orgId,
      {
        page: 1,
        pageSize: 1,
        search: "",
        sort: { field: "updated_at", direction: "desc" },
        filters: {},
      },
      { branch_id_or_global: branchId, status: ["open", "in_progress"] }
    );

    if ("error" in result) return result;
    return { success: true as const, data: { totalCount: result.data.totalCount } };
  });
}

export async function loadPlanningSummary(orgId: string, branchId: string) {
  return readWidget<HomePlanningSummary>(async () => {
    const context = await loadDashboardContextV2();
    const userId = context?.user.user?.id;
    if (!context || !userId || context.app.activeOrgId !== orgId) {
      return { success: false as const, error: "Unavailable" };
    }
    const supabase = await createClient();
    const preferences = await UserPreferencesService.getOrCreatePreferences(supabase, userId);
    const timeZone = preferences.timezone || "UTC";
    const today = isoToDateOnlyInTimeZone(new Date().toISOString(), timeZone);
    const baseParams = {
      page: 1,
      pageSize: 4,
      search: "",
      sort: { field: "due_at", direction: "asc" as const },
      filters: {},
    };
    const canReadBoards = checkPermission(context.user.permissionSnapshot, PLANNING_BOARDS_READ);
    const [tasks, open, inProgress, calendar, boards] = await Promise.all([
      PlanningTasksService.listForDataView(supabase, orgId, baseParams, {
        branch_id_or_global: branchId,
        status: ["open", "in_progress"],
      }),
      PlanningTasksService.listForDataView(
        supabase,
        orgId,
        { ...baseParams, pageSize: 1 },
        {
          branch_id_or_global: branchId,
          status: ["open"],
        }
      ),
      PlanningTasksService.listForDataView(
        supabase,
        orgId,
        { ...baseParams, pageSize: 1 },
        {
          branch_id_or_global: branchId,
          status: ["in_progress"],
        }
      ),
      getPlanningCalendarDataAction({
        rangeStart: today,
        rangeEnd: today,
        includeUnscheduled: false,
        unscheduledLimit: 0,
      }),
      canReadBoards
        ? KanbanBoardsService.listBoards(supabase, orgId, userId)
        : Promise.resolve({ success: true as const, data: [] }),
    ]);
    if (!tasks.success || !open.success || !inProgress.success || !calendar.success) {
      return { success: false as const, error: "Unavailable" };
    }
    const firstBoard = boards.success ? boards.data[0] : undefined;
    const board = firstBoard
      ? await KanbanBoardsService.getBoard(supabase, orgId, firstBoard.id, userId)
      : null;
    const calendarSources = new Map(calendar.data.sources.map((source) => [source.id, source]));
    return {
      success: true as const,
      data: {
        timeZone,
        todayItems: calendar.data.events
          .slice()
          .sort((a, b) =>
            (a.startAt ?? a.startDate ?? a.dueDate ?? "").localeCompare(
              b.startAt ?? b.startDate ?? b.dueDate ?? ""
            )
          )
          .slice(0, 5)
          .map((event) => {
            const source = calendarSources.get(event.calendarSourceId);
            return {
              ...event,
              calendarLabel: source?.label ?? event.category,
              calendarColor: event.color ?? source?.color ?? source?.defaultColor ?? "#6366f1",
            };
          }),
        tasks: tasks.data.rows,
        openCount: open.data.totalCount,
        inProgressCount: inProgress.data.totalCount,
        board: board?.success
          ? {
              id: board.data.id,
              title: board.data.title,
              columns: board.data.columns.map((column) => ({
                id: column.id,
                title: column.title,
                color: column.color,
                count: board.data.cards.filter((card) => card.column_id === column.id).length,
              })),
            }
          : null,
      },
    };
  });
}
