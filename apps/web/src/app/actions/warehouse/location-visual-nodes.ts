"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { WarehouseLocationVisualNodesService } from "@/server/services/warehouse-location-visual-nodes.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_READ,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_LAYOUTS_MANAGE,
} from "@/lib/constants/permissions";
import {
  upsertVisualNodeSchema,
  batchUpsertVisualNodesSchema,
  removeVisualNodeSchema,
  getUnmappedLocationsSchema,
  listVisualNodesSchema,
} from "./schemas";
import type { UpsertVisualNodeInput } from "@/lib/types/warehouse/locations-v2";

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

export async function listVisualNodesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = listVisualNodesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return WarehouseLocationVisualNodesService.listByLayout(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.layoutId,
      {
        viewType: parsed.data.viewType,
        viewContextLocationId: parsed.data.viewContextLocationId,
        includeHidden: parsed.data.includeHidden,
      }
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function upsertVisualNodeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = upsertVisualNodeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLocationVisualNodesService.upsertNode(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data as UpsertVisualNodeInput,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function batchUpsertVisualNodesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = batchUpsertVisualNodesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();

    const inputs = parsed.data.nodes.map((n) => ({
      ...n,
      layout_id: parsed.data.layout_id,
    })) as UpsertVisualNodeInput[];

    return WarehouseLocationVisualNodesService.batchUpsert(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layout_id,
      inputs,
      {
        replaceScope: parsed.data.replace_scope,
        viewType: parsed.data.view_type,
        viewContextLocationId: parsed.data.view_context_location_id,
      },
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function removeVisualNodeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = removeVisualNodeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLocationVisualNodesService.softDeleteNode(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.nodeId,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function hideVisualNodeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = removeVisualNodeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLocationVisualNodesService.hideNode(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.nodeId,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function restoreVisualNodeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = removeVisualNodeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLocationVisualNodesService.restoreNode(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.nodeId,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function getUnmappedLocationsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = getUnmappedLocationsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return WarehouseLocationVisualNodesService.getUnmappedLocations(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layoutId,
      { viewContextLocationId: parsed.data.viewContextLocationId }
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
