import { checkPermission } from "@/lib/utils/permissions";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_LOCATIONS_READ,
  MODULE_HELPDESK_ACCESS,
  HELPDESK_TICKETS_READ,
  MODULE_PLANNING_ACCESS,
  PLANNING_TASKS_READ,
  PERMISSION_TOOLS_READ,
} from "@/lib/constants/permissions";
import { MODULE_WAREHOUSE, MODULE_HELPDESK, MODULE_PLANNING } from "@/lib/constants/modules";
import type { ProjectedEvent } from "@/server/audit/types";

export type HomeAction = "tools" | "locations" | "tickets" | "tasks";
export type WidgetResult<T> = { state: "ready"; data: T } | { state: "unavailable" };

/** Same module + leaf permission gates as destination routes. Denies win. */
export function getHomeActions(
  snapshot: PermissionSnapshot,
  modules: string[],
  hasBranch: boolean
): HomeAction[] {
  const allowed = (...permissions: string[]) =>
    permissions.every((p) => checkPermission(snapshot, p));
  const actions: HomeAction[] = [];
  if (allowed(PERMISSION_TOOLS_READ)) actions.push("tools");
  if (
    hasBranch &&
    modules.includes(MODULE_WAREHOUSE) &&
    allowed(MODULE_WAREHOUSE_ACCESS, WAREHOUSE_LOCATIONS_READ)
  )
    actions.push("locations");
  if (
    hasBranch &&
    modules.includes(MODULE_HELPDESK) &&
    allowed(MODULE_HELPDESK_ACCESS, HELPDESK_TICKETS_READ)
  )
    actions.push("tickets");
  if (
    hasBranch &&
    modules.includes(MODULE_PLANNING) &&
    allowed(MODULE_PLANNING_ACCESS, PLANNING_TASKS_READ)
  )
    actions.push("tasks");
  return actions;
}

export const ATTENTION_STATUSES = ["open", "in_progress", "waiting", "waiting_response"];
export const ATTENTION_PRIORITIES = ["high", "urgent"];
export function attentionFilters(branchId: string) {
  return { branchId, status: ATTENTION_STATUSES, priority: ATTENTION_PRIORITIES };
}
export function ticketListQuery(branchId: string) {
  return { filters: JSON.stringify(attentionFilters(branchId)), sort: "updated_at.desc" };
}
/** Bounded personal preview, not a complete branch activity feed. */
export function activityForBranch(events: ProjectedEvent[], branchId: string | null) {
  return events
    .filter((event) => event.branch_id === null || event.branch_id === branchId)
    .slice(0, 5);
}
export function formatActivityDate(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}
export function formatRefreshTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Warsaw",
  }).format(date);
}
/** Optional widgets fail independently; never expose service/SQL errors. */
export async function readWidget<T>(
  read: () => Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<WidgetResult<T>> {
  try {
    const result = await read();
    return result.success ? { state: "ready", data: result.data } : { state: "unavailable" };
  } catch {
    return { state: "unavailable" };
  }
}
