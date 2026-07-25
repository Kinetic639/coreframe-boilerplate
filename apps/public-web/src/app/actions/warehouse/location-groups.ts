"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { WarehouseLocationGroupsService } from "@/server/services/warehouse-location-groups.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_READ,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_LOCATIONS_MANAGE,
} from "@/lib/constants/permissions";
import {
  createLocationGroupSchema,
  updateLocationGroupSchema,
  deleteLocationGroupSchema,
  reorderGroupsSchema,
} from "./schemas";

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function requireWarehouseContext() {
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

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function listLocationGroupsAction() {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const supabase = await createClient();
    return WarehouseLocationGroupsService.listByBranch(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createLocationGroupAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createLocationGroupSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const { name, description, color, sort_order, parent_location_id } = parsed.data;
    return WarehouseLocationGroupsService.create(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      { name: name!, description, color, sort_order, parent_location_id },
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateLocationGroupAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = updateLocationGroupSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { id, ...updateInput } = parsed.data;

    const supabase = await createClient();

    // Verify the group belongs to the active branch before mutating
    const fetchResult = await WarehouseLocationGroupsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Group not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Group does not belong to the active branch" };
    }

    return WarehouseLocationGroupsService.update(
      supabase,
      auth.context.app.activeOrgId,
      id,
      updateInput
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function reorderGroupsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = reorderGroupsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const supabase = await createClient();
    return WarehouseLocationGroupsService.reorderBatch(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.items as { id: string; sort_order: number }[]
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteLocationGroupAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = deleteLocationGroupSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();

    // Verify branch ownership before deleting
    const fetchResult = await WarehouseLocationGroupsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Group not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Group does not belong to the active branch" };
    }

    return WarehouseLocationGroupsService.softDelete(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
