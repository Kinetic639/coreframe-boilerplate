"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { WarehouseLayoutShapesService } from "@/server/services/warehouse-layout-shapes.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_READ,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_LAYOUTS_MANAGE,
} from "@/lib/constants/permissions";
import {
  layoutIdSchema,
  batchSaveShapesSchema,
  upsertOneShapeSchema,
  deleteShapeSchema,
} from "./layout-schemas";

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Verify the layout exists and belongs to the active branch.
 * Returns the layout on success or a failure result.
 */
async function verifyLayoutOwnership(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  activeBranchId: string,
  layoutId: string
) {
  const result = await WarehouseLayoutsService.getById(supabase, orgId, layoutId);
  if (!result.success) return result;
  if (!result.data) return { success: false as const, error: "Layout not found" };
  if (result.data.branch_id !== activeBranchId) {
    return { success: false as const, error: "Layout does not belong to the active branch" };
  }
  return { success: true as const, layout: result.data };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * List all active shapes for a layout.
 * The caller is responsible for knowing the layoutId — typically from the editor
 * state or the getLayoutWithShapesAction result.
 * Requires warehouse.layouts.read.
 */
export async function listShapesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = layoutIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    const layoutCheck = await verifyLayoutOwnership(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.id
    );
    if (!layoutCheck.success) return layoutCheck;

    return WarehouseLayoutShapesService.listByLayout(
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

/**
 * Batch save — the primary editor save action.
 *
 * Replaces the canonical shape state for a layout:
 * - Shapes absent from the input are soft-deleted
 * - Shapes present in the input are upserted
 *
 * Called on editor save (debounced, not on every drag event).
 * Requires warehouse.layouts.manage.
 */
export async function batchSaveShapesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to edit layouts" };
    }

    const parsed = batchSaveShapesSchema.safeParse(rawInput);
    if (!parsed.success) {
      // Return ALL errors joined so the toast is fully diagnostic.
      const msgs = parsed.error.errors.map((e) => {
        const path = e.path.length > 0 ? `[${e.path.join(".")}] ` : "";
        return `${path}${e.message}`;
      });
      return { success: false, error: msgs.join(" | ") };
    }

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();

    const layoutCheck = await verifyLayoutOwnership(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layout_id
    );
    if (!layoutCheck.success) return layoutCheck;

    return WarehouseLayoutShapesService.batchSave(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layout_id,
      userId,
      parsed.data.shapes as import("@/lib/warehouse/layouts").ShapeUpsertInput[]
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Upsert a single shape — for incremental saves after individual drag-end events.
 * Prefer batchSaveShapesAction for full canvas state saves.
 * Requires warehouse.layouts.manage.
 */
export async function upsertOneShapeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to edit layouts" };
    }

    const parsed = upsertOneShapeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();

    const layoutCheck = await verifyLayoutOwnership(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layout_id
    );
    if (!layoutCheck.success) return layoutCheck;

    return WarehouseLayoutShapesService.upsertOne(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data.layout_id,
      userId,
      parsed.data.shape as import("@/lib/warehouse/layouts").ShapeUpsertInput
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Soft-delete a single shape.
 * Requires warehouse.layouts.manage.
 */
export async function deleteShapeAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to manage layouts" };
    }

    const parsed = deleteShapeSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    const shapeResult = await WarehouseLayoutShapesService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!shapeResult.success) return shapeResult;
    if (!shapeResult.data) return { success: false, error: "Shape not found" };
    if (shapeResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Shape does not belong to the active branch" };
    }

    return WarehouseLayoutShapesService.softDelete(
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
