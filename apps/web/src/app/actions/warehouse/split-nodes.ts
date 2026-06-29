"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { WarehouseLayoutSplitNodesService } from "@/server/services/warehouse-layout-split-nodes.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_READ,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_LAYOUTS_MANAGE,
} from "@/lib/constants/permissions";
import {
  listSplitNodesSchema,
  createSplitNodeSchema,
  resizeSplitSchema,
  removeSplitNodeSchema,
  linkSplitToLocationSchema,
  unlinkSplitFromLocationSchema,
} from "./schemas";
import type { CreateSplitNodeInput } from "@/lib/types/warehouse/locations-v2";

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

export async function listSplitNodesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = listSplitNodesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return WarehouseLayoutSplitNodesService.listByLayout(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.layoutId,
      { parentVisualNodeId: parsed.data.parentVisualNodeId }
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createSplitAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = createSplitNodeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLayoutSplitNodesService.createSplit(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layout_id,
      parsed.data as CreateSplitNodeInput,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function resizeSplitAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = resizeSplitSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLayoutSplitNodesService.resizeSplit(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.nodeId,
      parsed.data.sizeMode,
      parsed.data.sizeValue ?? null,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function removeSplitNodeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = removeSplitNodeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLayoutSplitNodesService.removeSplitNode(
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

export async function linkSplitToLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = linkSplitToLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLayoutSplitNodesService.linkLocation(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.splitNodeId,
      parsed.data.locationId,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function unlinkSplitFromLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = unlinkSplitFromLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLayoutSplitNodesService.unlinkLocation(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.splitNodeId,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
