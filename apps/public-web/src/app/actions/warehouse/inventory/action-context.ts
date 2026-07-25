import "server-only";

import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { eventService } from "@/server/services/event.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import { MODULE_WAREHOUSE_ACCESS, WAREHOUSE_READ } from "@/lib/constants/permissions";
import type { DataViewListParams } from "@/lib/data-view/types";
import { checkPermission } from "@/lib/utils/permissions";

export async function requireWarehouseContext() {
  await entitlements.requireModuleAccess(MODULE_WAREHOUSE);
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) {
    return { success: false as const, error: "No active organization" };
  }
  if (!checkPermission(context.user.permissionSnapshot, MODULE_WAREHOUSE_ACCESS)) {
    return { success: false as const, error: "Unauthorized" };
  }
  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_READ)) {
    return { success: false as const, error: "Unauthorized" };
  }
  return { success: true as const, context };
}

export function hasPermission(
  auth: Awaited<ReturnType<typeof requireWarehouseContext>>,
  slug: string
) {
  return auth.success && checkPermission(auth.context.user.permissionSnapshot, slug);
}

export type WarehouseAuth = Extract<
  Awaited<ReturnType<typeof requireWarehouseContext>>,
  { success: true }
>;

export function requireActiveBranch(auth: WarehouseAuth) {
  if (!auth.context.app.activeBranchId) {
    return { success: false as const, error: "No active branch - select a branch" };
  }
  return { success: true as const, branchId: auth.context.app.activeBranchId };
}

export function userIdFrom(auth: WarehouseAuth) {
  return auth.context.user.user?.id ?? null;
}

export function normalizeListParams(data: {
  search?: string;
  sort?: { field?: string; direction?: "asc" | "desc" } | null;
  page?: number;
  pageSize?: number;
  filters?: Record<string, string | string[] | boolean | null>;
}): DataViewListParams {
  return {
    search: data.search ?? "",
    sort:
      data.sort && data.sort.field && data.sort.direction
        ? { field: data.sort.field, direction: data.sort.direction }
        : null,
    page: data.page ?? 1,
    pageSize: data.pageSize ?? 50,
    filters: data.filters ?? {},
  };
}

export function mapUnexpected(error: unknown) {
  const mapped = mapEntitlementError(error);
  if (mapped) return { success: false as const, error: mapped.message };
  return { success: false as const, error: "Unexpected error" };
}

/**
 * Relocated from src/app/actions/warehouse/inventory/index.ts (unchanged
 * behavior) so it can be shared with the split-out count-sessions action
 * module without duplication — index.ts still uses this via re-export.
 */
export async function emitInventoryEvent(
  auth: WarehouseAuth,
  userId: string | null | undefined,
  input: {
    actionKey: string;
    entityType: string;
    entityId: string;
    eventTier?: "baseline" | "enhanced" | "forensic";
    metadata?: Record<string, unknown>;
    branchId?: string | null;
  }
) {
  if (!userId) return;
  await eventService.emit({
    actionKey: input.actionKey,
    actorType: "user",
    actorUserId: userId,
    organizationId: auth.context.app.activeOrgId,
    branchId: input.branchId ?? auth.context.app.activeBranchId ?? null,
    entityType: input.entityType,
    entityId: input.entityId,
    eventTier: input.eventTier ?? "enhanced",
    metadata: input.metadata ?? {},
  });
}

/** Relocated from index.ts (unchanged behavior) — see emitInventoryEvent. */
export function textFromRecord(value: unknown, keys: string[]) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  return null;
}
