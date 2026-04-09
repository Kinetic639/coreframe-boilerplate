"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { eventService } from "@/server/services/event.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_READ,
  WAREHOUSE_LAYOUTS_READ,
  WAREHOUSE_LAYOUTS_MANAGE,
  WAREHOUSE_LAYOUTS_PUBLISH,
} from "@/lib/constants/permissions";
import { z } from "zod";
import {
  createLayoutSchema,
  createLayoutForLocationSchema,
  updateLayoutSchema,
  layoutIdSchema,
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

// ─── Actions ──────────────────────────────────────────────────────────────────

/**
 * List all active layouts for the active branch (draft + published).
 * Requires warehouse.layouts.read.
 */
export async function listLayoutsAction() {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to view layouts" };
    }

    const supabase = await createClient();
    return WarehouseLayoutsService.listByBranch(
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

/**
 * Get a single layout with its shapes pre-loaded.
 * Verifies the layout belongs to the active branch before returning.
 * Requires warehouse.layouts.read.
 */
export async function getLayoutWithShapesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = layoutIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to view layouts" };
    }

    const supabase = await createClient();
    const result = await WarehouseLayoutsService.getWithShapes(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!result.success) return result;

    // Fail closed: reject if the layout does not belong to the active branch.
    if (result.data && result.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Layout does not belong to the active branch" };
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Get the published layout for the active branch scope, with shapes.
 * Used by the viewer dialog when no specific layoutId is known.
 * rootLocationId is optional — null means whole-branch published layout.
 * Requires warehouse.layouts.read.
 */
export async function getPublishedLayoutAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to view layouts" };
    }

    const publishedScopeSchema = z.object({
      root_location_id: z.string().uuid().nullable().optional(),
    });
    const parsed =
      rawInput === undefined
        ? { success: true as const, data: {} }
        : publishedScopeSchema.safeParse(rawInput);

    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message };
    }

    // Preserve undefined vs null distinction:
    //   undefined → no scope filter (any published layout)
    //   null      → whole-branch layout (root_location_id IS NULL)
    //   string    → specific root location scope
    const rootLocationId = parsed.data.root_location_id;

    const supabase = await createClient();
    return WarehouseLayoutsService.getPublishedForScope(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      rootLocationId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Create a new draft layout for the active branch.
 * Requires warehouse.layouts.manage.
 */
export async function createLayoutAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createLayoutSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to create a layout" };
    }

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const orgId = auth.context.app.activeOrgId;
    const branchId = auth.context.app.activeBranchId;

    // Atomically create the root warehouse_location + layout in one DB transaction.
    // If the layout INSERT fails the location INSERT is rolled back — no orphan locations.
    const result = await WarehouseLayoutsService.createWithRootLocation(
      supabase,
      orgId,
      branchId,
      userId,
      {
        name: parsed.data.name,
        description: parsed.data.description,
        root_location_code: parsed.data.root_location_code,
        canvas_width_m: parsed.data.canvas_width_m,
        canvas_height_m: parsed.data.canvas_height_m,
      }
    );

    if (result.success) {
      await eventService
        .emit({
          actionKey: "warehouse.layout.created",
          actorType: "user",
          actorUserId: userId,
          organizationId: auth.context.app.activeOrgId,
          branchId: auth.context.app.activeBranchId,
          entityType: "warehouse_layout",
          entityId: result.data.id,
          metadata: { layout_id: result.data.id, layout_name: result.data.name },
          eventTier: "baseline",
        })
        .catch((err) => console.error("[createLayoutAction] Failed to emit event:", err));
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Create a new draft layout scoped to an already-existing warehouse location.
 * Unlike createLayoutAction, this does NOT auto-create a root location — it
 * links to one that already exists (e.g. a top-level location from the tree).
 * Requires warehouse.layouts.manage.
 */
export async function createLayoutForLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createLayoutForLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to create a layout" };
    }

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const orgId = auth.context.app.activeOrgId;
    const branchId = auth.context.app.activeBranchId;

    // Validate the root_location_id belongs to the active branch (cross-branch guard).
    const { data: locRow, error: locErr } = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("id", parsed.data.location_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .maybeSingle();

    if (locErr) return { success: false, error: locErr.message };
    if (!locRow)
      return {
        success: false,
        error: "Location not found or does not belong to the active branch",
      };

    const result = await WarehouseLayoutsService.create(supabase, orgId, branchId, userId, {
      name: parsed.data.name,
      description: parsed.data.description,
      root_location_id: parsed.data.location_id,
      canvas_width_m: parsed.data.canvas_width_m,
      canvas_height_m: parsed.data.canvas_height_m,
    });

    if (result.success) {
      await eventService
        .emit({
          actionKey: "warehouse.layout.created",
          actorType: "user",
          actorUserId: userId,
          organizationId: auth.context.app.activeOrgId,
          branchId: auth.context.app.activeBranchId,
          entityType: "warehouse_layout",
          entityId: result.data.id,
          metadata: { layout_id: result.data.id, layout_name: result.data.name },
          eventTier: "baseline",
        })
        .catch((err) =>
          console.error("[createLayoutForLocationAction] Failed to emit event:", err)
        );
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Update layout metadata (name, description, canvas dimensions).
 * Does not affect status — use publish/unpublish actions for that.
 * Requires warehouse.layouts.manage.
 */
export async function updateLayoutAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to manage layouts" };
    }

    const parsed = updateLayoutSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { id, ...updateInput } = parsed.data;
    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();

    // Fail closed: verify the layout belongs to the active branch.
    const fetchResult = await WarehouseLayoutsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Layout not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Layout does not belong to the active branch" };
    }

    return WarehouseLayoutsService.update(
      supabase,
      auth.context.app.activeOrgId,
      id,
      userId,
      updateInput
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Publish a layout as the canonical map for its scope.
 * Atomically unpublishes the current published layout for the same scope.
 * Requires warehouse.layouts.publish (separate from manage — intentional).
 */
export async function publishLayoutAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_PUBLISH)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to publish a layout" };
    }

    const parsed = layoutIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();

    // Fail closed: verify the layout belongs to the active branch.
    const fetchResult = await WarehouseLayoutsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Layout not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Layout does not belong to the active branch" };
    }

    const result = await WarehouseLayoutsService.publish(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      userId
    );

    if (result.success) {
      await eventService
        .emit({
          actionKey: "warehouse.layout.published",
          actorType: "user",
          actorUserId: userId,
          organizationId: auth.context.app.activeOrgId,
          branchId: auth.context.app.activeBranchId,
          entityType: "warehouse_layout",
          entityId: result.data.id,
          metadata: { layout_id: result.data.id, layout_name: result.data.name },
          eventTier: "enhanced",
        })
        .catch((err) => console.error("[publishLayoutAction] Failed to emit event:", err));
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Revert a published layout back to draft status.
 * Requires warehouse.layouts.publish (same gate as publish — intentional).
 */
export async function unpublishLayoutAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_PUBLISH)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const parsed = layoutIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();

    const fetchResult = await WarehouseLayoutsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Layout not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Layout does not belong to the active branch" };
    }

    return WarehouseLayoutsService.unpublish(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Soft-delete a layout and all its shapes.
 * Requires warehouse.layouts.manage.
 */
export async function deleteLayoutAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to manage layouts" };
    }

    const parsed = layoutIdSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();

    const fetchResult = await WarehouseLayoutsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Layout not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Layout does not belong to the active branch" };
    }

    const result = await WarehouseLayoutsService.softDelete(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );

    if (result.success) {
      await eventService
        .emit({
          actionKey: "warehouse.layout.deleted",
          actorType: "user",
          actorUserId: userId ?? null,
          organizationId: auth.context.app.activeOrgId,
          branchId: auth.context.app.activeBranchId,
          entityType: "warehouse_layout",
          entityId: parsed.data.id,
          metadata: {
            layout_id: parsed.data.id,
            layout_name: fetchResult.data.name,
          },
          eventTier: "enhanced",
        })
        .catch((err) => console.error("[deleteLayoutAction] Failed to emit event:", err));
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
