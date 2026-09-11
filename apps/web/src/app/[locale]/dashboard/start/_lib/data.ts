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
import { getPersonalActivityAction } from "@/app/actions/audit/get-personal-activity";
import { createClient } from "@/utils/supabase/server";
import type { PaginatedResult } from "@/lib/data-view/types";
import { attentionFilters, getHomeActions, readWidget } from "./model";

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
      { branch_id: branchId, status: ["open", "in_progress"] }
    );

    if ("error" in result) return result;
    return { success: true as const, data: { totalCount: result.data.totalCount } };
  });
}
