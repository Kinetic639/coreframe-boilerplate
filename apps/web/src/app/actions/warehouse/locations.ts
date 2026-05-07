"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { entitlements, mapEntitlementError } from "@/server/guards/entitlements-guards";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { eventService } from "@/server/services/event.service";
import { MODULE_WAREHOUSE } from "@/lib/constants/modules";
import {
  MODULE_WAREHOUSE_ACCESS,
  WAREHOUSE_READ,
  WAREHOUSE_LOCATIONS_READ,
  WAREHOUSE_LOCATIONS_MANAGE,
} from "@/lib/constants/permissions";
import {
  createLocationSchema,
  updateLocationSchema,
  deleteLocationSchema,
  getLocationSchema,
  reorderLocationsSchema,
  archiveLocationSchema,
  getLocationMappingStatusSchema,
  updateLocationV2Schema,
  createLocationV2Schema,
} from "./schemas";
import type { UpdateLocationV2Input } from "@/lib/types/warehouse/locations-v2";

// ─── Shared auth helper ───────────────────────────────────────────────────────

/**
 * Validate plan entitlement, user authentication, and MODULE_WAREHOUSE_ACCESS.
 * Returns the context on success or a failure result on denial.
 */
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

export async function listLocationsAction() {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    // Active branch is the authoritative warehouse context. Branch id must not be
    // accepted from the client — that would allow cross-branch data leakage.
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to view locations" };
    }

    const supabase = await createClient();
    return WarehouseLocationsService.listByBranch(
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

export async function getLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = getLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    // Active branch is required for reads — prevents cross-branch enumeration.
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to view locations" };
    }

    const supabase = await createClient();
    const result = await WarehouseLocationsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!result.success) return result;

    // Fail closed: reject if the location does not belong to the active branch.
    if (result.data && result.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Location does not belong to the active branch" };
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = createLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to create a location" };
    }

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    const result = await WarehouseLocationsService.create(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data as import("@/server/services/warehouse-locations.service").CreateLocationInput,
      userId
    );

    if (result.success) {
      const emitResult = await eventService.emit({
        actionKey: "warehouse.location.created",
        actorType: "user",
        actorUserId: userId,
        organizationId: auth.context.app.activeOrgId,
        branchId: auth.context.app.activeBranchId,
        entityType: "warehouse_location",
        entityId: result.data.id,
        metadata: {
          location_id: result.data.id,
          location_name: result.data.name,
          branch_id: auth.context.app.activeBranchId,
          parent_id: result.data.parent_id ?? null,
        },
        eventTier: "baseline",
      });
      if (!emitResult.success) {
        console.error("[createLocationAction] Failed to emit warehouse.location.created:", {
          locationId: result.data.id,
          error: (emitResult as { success: false; error: string }).error,
        });
      }
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    // Active branch is required: mutations are branch-scoped. Without an active
    // branch the RLS boundary cannot be verified at the application layer.
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to manage locations" };
    }

    const parsed = updateLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { id, ...updateInput } = parsed.data;
    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();

    // Fail closed: verify the location belongs to the active branch before mutating.
    const fetchResult = await WarehouseLocationsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Location not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Location does not belong to the active branch" };
    }

    const result = await WarehouseLocationsService.update(
      supabase,
      auth.context.app.activeOrgId,
      id,
      updateInput,
      userId
    );

    if (result.success) {
      const updatedFields = Object.keys(updateInput).filter(
        (k) => (updateInput as Record<string, unknown>)[k] !== undefined
      );
      const branchId = result.data.branch_id;
      const emitResult = await eventService.emit({
        actionKey: "warehouse.location.updated",
        actorType: "user",
        actorUserId: userId,
        organizationId: auth.context.app.activeOrgId,
        branchId,
        entityType: "warehouse_location",
        entityId: id,
        metadata: {
          location_id: id,
          location_name: result.data.name,
          branch_id: branchId,
          updated_fields: updatedFields,
        },
        eventTier: "baseline",
      });
      if (!emitResult.success) {
        console.error("[updateLocationAction] Failed to emit warehouse.location.updated:", {
          locationId: id,
          error: (emitResult as { success: false; error: string }).error,
        });
      }
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    // Active branch is required: mutations are branch-scoped. Without an active
    // branch the RLS boundary cannot be verified at the application layer.
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to manage locations" };
    }

    const parsed = deleteLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();

    // Fetch name + branchId before deletion for event metadata, and to confirm
    // the location belongs to the active branch.
    const fetchResult = await WarehouseLocationsService.getById(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Location not found" };

    // Fail closed: reject if the location belongs to a different branch.
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Location does not belong to the active branch" };
    }

    const { name: locationName, branch_id: branchId } = fetchResult.data;
    const userId = auth.context.user.user?.id;

    const result = await WarehouseLocationsService.softDelete(
      supabase,
      auth.context.app.activeOrgId,
      parsed.data.id
    );

    if (result.success) {
      const emitResult = await eventService.emit({
        actionKey: "warehouse.location.deleted",
        actorType: "user",
        actorUserId: userId ?? null,
        organizationId: auth.context.app.activeOrgId,
        branchId,
        entityType: "warehouse_location",
        entityId: parsed.data.id,
        metadata: {
          location_id: parsed.data.id,
          location_name: locationName,
          branch_id: branchId,
        },
        eventTier: "enhanced",
      });
      if (!emitResult.success) {
        console.error("[deleteLocationAction] Failed to emit warehouse.location.deleted:", {
          locationId: parsed.data.id,
          error: (emitResult as { success: false; error: string }).error,
        });
      }
    }

    return result;
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function reorderLocationsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = reorderLocationsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch" };
    }

    const supabase = await createClient();
    return WarehouseLocationsService.reorderBatch(
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

export async function listPlacedLocationIdsAction() {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;

    if (!auth.context.app.activeBranchId) {
      return { success: true, data: [] as string[] };
    }

    const supabase = await createClient();
    return WarehouseLocationsService.listPlacedLocationIds(
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

// ─── V2 Actions ───────────────────────────────────────────────────────────────

export async function validateArchiveLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return WarehouseLocationsService.validateArchive(
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

export async function archiveLocationAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = archiveLocationSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    // Verify location belongs to active branch before archiving
    const fetchResult = await WarehouseLocationsService.getById(
      await createClient(),
      auth.context.app.activeOrgId,
      parsed.data.id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Location not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Location does not belong to the active branch" };
    }

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLocationsService.archiveLocation(
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

export async function getLocationMappingStatusAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_READ)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = getLocationMappingStatusSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return WarehouseLocationsService.getMappingStatus(
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

export async function updateLocationV2Action(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = updateLocationV2Schema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const { id, ...fields } = parsed.data;

    // Verify location belongs to active branch
    const fetchResult = await WarehouseLocationsService.getById(
      await createClient(),
      auth.context.app.activeOrgId,
      id
    );
    if (!fetchResult.success) return fetchResult;
    if (!fetchResult.data) return { success: false, error: "Location not found" };
    if (fetchResult.data.branch_id !== auth.context.app.activeBranchId) {
      return { success: false, error: "Location does not belong to the active branch" };
    }

    const userId = auth.context.user.user?.id;
    const supabase = await createClient();
    return WarehouseLocationsService.updateV2Fields(
      supabase,
      auth.context.app.activeOrgId,
      id,
      fields as UpdateLocationV2Input,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}

export async function createLocationV2Action(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!checkPermission(auth.context.user.permissionSnapshot, WAREHOUSE_LOCATIONS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!auth.context.app.activeBranchId) {
      return { success: false, error: "No active branch — select a branch to create a location" };
    }

    const parsed = createLocationV2Schema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = auth.context.user.user?.id;
    if (!userId) return { success: false, error: "User identity unavailable" };

    const supabase = await createClient();
    return WarehouseLocationsService.create(
      supabase,
      auth.context.app.activeOrgId,
      auth.context.app.activeBranchId,
      parsed.data as import("@/server/services/warehouse-locations.service").CreateLocationInput,
      userId
    );
  } catch (error) {
    const mapped = mapEntitlementError(error);
    if (mapped) return { success: false, error: mapped.message };
    return { success: false, error: "Unexpected error" };
  }
}
