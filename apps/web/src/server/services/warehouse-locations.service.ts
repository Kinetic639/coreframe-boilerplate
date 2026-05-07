/**
 * Warehouse Locations Service
 *
 * Manages the nested location structure within a branch warehouse.
 * Branch is the warehouse boundary — every location belongs to exactly one branch.
 *
 * Constraints:
 * - server-only (never import from client components)
 * - uses authenticated Supabase client only (no service role)
 * - never bypasses RLS
 * - fail-closed: returns ServiceResult<T>, never throws to callers
 * - no stock, movement, document, or product coupling
 *
 * Hierarchy guarantees:
 * - Self-parent is blocked at DB level (CHECK constraint) and service level.
 * - Cyclical reparenting is blocked by wouldCreateCycle() before any UPDATE.
 * - Soft-delete explicitly reparents direct children to root (parent_id = NULL,
 *   level = 0) and cascades level values to all descendants of reparented children.
 *   This keeps the DB state consistent — no dangling parent_id references to
 *   soft-deleted rows.
 * - Level values are always kept consistent: when a node is reparented the service
 *   recomputes its level and cascades the new values to all descendants.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LocationStatus,
  LocationCategory,
  LocationV2,
  MappingStatusResult,
  ArchiveValidationResult,
  UpdateLocationV2Input,
} from "@/lib/types/warehouse/locations-v2";

// ─── Types (re-exported from shared lib so client components can import safely) ──

export type { WarehouseLocation, WarehouseLocationTreeNode } from "@/lib/warehouse/location-tree";
export { buildLocationTree } from "@/lib/warehouse/location-tree";

import type { WarehouseLocation } from "@/lib/warehouse/location-tree";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface CreateLocationInput {
  name: string;
  code?: string | null;
  description?: string | null;
  icon_name?: string | null;
  color?: string | null;
  parent_id?: string | null;
  group_id?: string | null;
  inherit_group_color?: boolean;
  inherit_parent_color?: boolean;
  physical_width_m?: number | null;
  physical_depth_m?: number | null;
  physical_height_m?: number | null;
  physical_elevation_start_m?: number | null;
  elevation_level?: number;
  map_role?: WarehouseLocation["map_role"];
  storage_mode?: string;
  allow_top_storage?: boolean;
  sort_order?: number;
  // V2 fields (optional for backward compatibility)
  can_store_inventory?: boolean;
  location_category?: string;
  width_mm?: number | null;
  height_mm?: number | null;
  depth_mm?: number | null;
}

export interface UpdateLocationInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  icon_name?: string | null;
  color?: string | null;
  parent_id?: string | null;
  group_id?: string | null;
  inherit_group_color?: boolean;
  inherit_parent_color?: boolean;
  physical_width_m?: number | null;
  physical_depth_m?: number | null;
  physical_height_m?: number | null;
  physical_elevation_start_m?: number | null;
  elevation_level?: number;
  map_role?: WarehouseLocation["map_role"];
  storage_mode?: string;
  allow_top_storage?: boolean;
  sort_order?: number;
}

// ─── Column select ────────────────────────────────────────────────────────────

const LOCATION_COLUMNS =
  "id, organization_id, branch_id, name, code, description, icon_name, color, parent_id, group_id, inherit_group_color, inherit_parent_color, physical_width_m, physical_depth_m, physical_height_m, physical_elevation_start_m, elevation_level, map_role, storage_mode, allow_top_storage, level, sort_order, qr_code, created_by, updated_by, created_at, updated_at, deleted_at" as const;

const GROUP_SCOPE_COLUMNS =
  "id, organization_id, branch_id, parent_location_id, deleted_at" as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLocationsService {
  /**
   * List all active (non-deleted) locations for a specific branch.
   * Returns a flat list sorted by level then sort_order.
   * Callers may pass this to buildLocationTree() to get a nested structure.
   */
  static async listByBranch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<WarehouseLocation[]>> {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select(LOCATION_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("level", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocation[] };
  }

  /**
   * Returns distinct location IDs that have a shape on any layout for the branch.
   * Used by the locations page to mark/sort placed vs. unplaced locations.
   */
  static async listPlacedLocationIds(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<string[]>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .select("location_id")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .not("location_id", "is", null)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    const ids = [...new Set((data ?? []).map((r: any) => r.location_id as string))];
    return { success: true, data: ids };
  }

  /**
   * Get a single active location by id, scoped to the organisation.
   * Returns null data (not an error) when the location does not exist or
   * belongs to a different org — prevents enumeration.
   */
  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<WarehouseLocation | null>> {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select(LOCATION_COLUMNS)
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocation | null };
  }

  /**
   * Resolve the direct children of a location.
   * Useful for lazy-loading tree nodes and for cascade operations.
   */
  static async getChildren(
    supabase: SupabaseClient,
    orgId: string,
    parentId: string
  ): Promise<ServiceResult<WarehouseLocation[]>> {
    const { data, error } = await supabase
      .from("warehouse_locations")
      .select(LOCATION_COLUMNS)
      .eq("organization_id", orgId)
      .eq("parent_id", parentId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocation[] };
  }

  /**
   * Create a new location within a branch.
   * Level is derived from the parent's level (+1) or defaults to 0.
   * The parent, if provided, must belong to the same org and branch.
   */
  static async create(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreateLocationInput,
    userId: string
  ): Promise<ServiceResult<WarehouseLocation>> {
    let level = 0;
    const effectiveParentId = input.parent_id ?? null;

    if (input.parent_id) {
      const parentResult = await WarehouseLocationsService.getById(
        supabase,
        orgId,
        input.parent_id
      );
      if (!parentResult.success) return parentResult;
      if (!parentResult.data) return { success: false, error: "Parent location not found" };
      if (parentResult.data.branch_id !== branchId) {
        return { success: false, error: "Parent location belongs to a different branch" };
      }
      level = parentResult.data.level + 1;
    }

    const groupValidation = await WarehouseLocationsService.validateGroupAssignment(
      supabase,
      orgId,
      branchId,
      effectiveParentId,
      input.group_id ?? null
    );
    if (!groupValidation.success) {
      return {
        success: false,
        error: (groupValidation as { success: false; error: string }).error,
      };
    }

    const frontSegmentValidation = await WarehouseLocationsService.validateFrontSegmentHeight(
      supabase,
      orgId,
      branchId,
      {
        locationId: null,
        parentId: effectiveParentId,
        mapRole: input.map_role ?? "logical",
        physicalHeightM: input.physical_height_m ?? null,
      }
    );
    if (frontSegmentValidation.success === false) {
      return { success: false, error: frontSegmentValidation.error };
    }

    const { data, error } = await supabase
      .from("warehouse_locations")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        name: input.name,
        code: input.code ?? null,
        description: input.description ?? null,
        icon_name: input.icon_name ?? null,
        color: input.color ?? null,
        parent_id: input.parent_id ?? null,
        group_id: input.group_id ?? null,
        inherit_group_color: input.group_id ? (input.inherit_group_color ?? false) : false,
        inherit_parent_color: input.parent_id ? (input.inherit_parent_color ?? false) : false,
        physical_width_m: input.physical_width_m ?? null,
        physical_depth_m: input.physical_depth_m ?? null,
        physical_height_m: input.physical_height_m ?? null,
        physical_elevation_start_m: input.physical_elevation_start_m ?? null,
        elevation_level: input.elevation_level ?? 1,
        map_role: input.map_role ?? "logical",
        storage_mode: input.storage_mode ?? "standard",
        allow_top_storage: input.allow_top_storage ?? false,
        level,
        sort_order: input.sort_order ?? 0,
        created_by: userId,
        updated_by: userId,
        // V2 fields
        ...(input.can_store_inventory !== undefined && {
          can_store_inventory: input.can_store_inventory,
        }),
        ...(input.location_category !== undefined && {
          location_category: input.location_category,
        }),
        ...(input.width_mm !== undefined && { width_mm: input.width_mm }),
        ...(input.height_mm !== undefined && { height_mm: input.height_mm }),
        ...(input.depth_mm !== undefined && { depth_mm: input.depth_mm }),
      })
      .select(LOCATION_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "A location with this code already exists under the same parent location",
        };
      }
      return { success: false, error: error.message };
    }

    return { success: true, data: data as WarehouseLocation };
  }

  /**
   * Update an existing location.
   *
   * If parent_id changes:
   * - Self-parent is rejected.
   * - Reparenting into a descendant (cycle) is rejected.
   * - Level is recomputed from the new parent and cascaded to all descendants.
   * - The new parent must belong to the same org and branch.
   */
  static async update(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    input: UpdateLocationInput,
    userId: string
  ): Promise<ServiceResult<WarehouseLocation>> {
    // Fetch current state to validate org scope and compute level if parent changes
    const currentResult = await WarehouseLocationsService.getById(supabase, orgId, id);
    if (!currentResult.success) return currentResult;
    if (!currentResult.data) return { success: false, error: "Location not found" };

    const current = currentResult.data;
    const updatePayload: Record<string, unknown> = { updated_by: userId };

    if (input.name !== undefined) updatePayload.name = input.name;
    if (input.code !== undefined) updatePayload.code = input.code;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.icon_name !== undefined) updatePayload.icon_name = input.icon_name;
    if (input.color !== undefined) updatePayload.color = input.color;
    if (input.sort_order !== undefined) updatePayload.sort_order = input.sort_order;
    if (input.group_id !== undefined) updatePayload.group_id = input.group_id;
    if (input.inherit_group_color !== undefined) {
      updatePayload.inherit_group_color = input.inherit_group_color;
    }
    if (input.inherit_parent_color !== undefined) {
      updatePayload.inherit_parent_color = input.inherit_parent_color;
    }
    if (input.physical_width_m !== undefined) {
      updatePayload.physical_width_m = input.physical_width_m;
    }
    if (input.physical_depth_m !== undefined) {
      updatePayload.physical_depth_m = input.physical_depth_m;
    }
    if (input.physical_height_m !== undefined) {
      updatePayload.physical_height_m = input.physical_height_m;
    }
    if (input.physical_elevation_start_m !== undefined) {
      updatePayload.physical_elevation_start_m = input.physical_elevation_start_m;
    }
    if (input.elevation_level !== undefined) {
      updatePayload.elevation_level = input.elevation_level;
    }
    if (input.map_role !== undefined) {
      updatePayload.map_role = input.map_role;
    }
    if (input.storage_mode !== undefined) {
      updatePayload.storage_mode = input.storage_mode;
    }
    if (input.allow_top_storage !== undefined) {
      updatePayload.allow_top_storage = input.allow_top_storage;
    }

    let newLevel: number | undefined;

    if (input.parent_id !== undefined) {
      if (input.parent_id === id) {
        return { success: false, error: "A location cannot be its own parent" };
      }
      updatePayload.parent_id = input.parent_id;

      if (input.parent_id === null) {
        newLevel = 0;
        updatePayload.level = 0;
      } else {
        // Guard against cyclical reparenting: reject if this node is an ancestor
        // of the proposed new parent (which would create A → B → ... → A).
        const cycleCheck = await WarehouseLocationsService.wouldCreateCycle(
          supabase,
          orgId,
          id,
          input.parent_id
        );
        if (cycleCheck.success === false) return { success: false, error: cycleCheck.error };
        if (cycleCheck.data) {
          return {
            success: false,
            error: "Cannot reparent a location into one of its own descendants",
          };
        }

        const newParentResult = await WarehouseLocationsService.getById(
          supabase,
          orgId,
          input.parent_id
        );
        if (!newParentResult.success) return newParentResult;
        if (!newParentResult.data)
          return { success: false, error: "New parent location not found" };
        if (newParentResult.data.branch_id !== current.branch_id) {
          return { success: false, error: "Parent location belongs to a different branch" };
        }
        newLevel = newParentResult.data.level + 1;
        updatePayload.level = newLevel;
      }
    }

    const effectiveParentId = input.parent_id !== undefined ? input.parent_id : current.parent_id;
    const effectiveMapRole =
      input.map_role !== undefined ? input.map_role : (current.map_role ?? "logical");
    const effectivePhysicalHeightM =
      input.physical_height_m !== undefined ? input.physical_height_m : current.physical_height_m;
    const effectiveGroupId = input.group_id !== undefined ? input.group_id : current.group_id;
    const effectiveInheritGroupColor =
      input.inherit_group_color !== undefined
        ? input.inherit_group_color
        : current.inherit_group_color;
    const effectiveInheritParentColor =
      input.inherit_parent_color !== undefined
        ? input.inherit_parent_color
        : (current.inherit_parent_color ?? false);
    const groupValidation = await WarehouseLocationsService.validateGroupAssignment(
      supabase,
      orgId,
      current.branch_id,
      effectiveParentId ?? null,
      effectiveGroupId ?? null
    );
    if (!groupValidation.success) {
      return {
        success: false,
        error: (groupValidation as { success: false; error: string }).error,
      };
    }

    if (!effectiveGroupId && effectiveInheritGroupColor) {
      updatePayload.inherit_group_color = false;
    }
    if (!effectiveParentId && effectiveInheritParentColor) {
      updatePayload.inherit_parent_color = false;
    }

    const frontSegmentValidation = await WarehouseLocationsService.validateFrontSegmentHeight(
      supabase,
      orgId,
      current.branch_id,
      {
        locationId: id,
        parentId: effectiveParentId,
        mapRole: effectiveMapRole,
        physicalHeightM: effectivePhysicalHeightM ?? null,
      }
    );
    if (frontSegmentValidation.success === false) {
      return { success: false, error: frontSegmentValidation.error };
    }

    const { data, error } = await supabase
      .from("warehouse_locations")
      .update(updatePayload)
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(LOCATION_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "A location with this code already exists under the same parent location",
        };
      }
      return { success: false, error: error.message };
    }

    // If the node's level changed, cascade the new level values to all descendants
    // via the DB RPC (single recursive CTE — atomic and fast).
    if (newLevel !== undefined && newLevel !== current.level) {
      const { error: cascadeError } = await supabase.rpc("cascade_warehouse_location_levels", {
        p_org_id: orgId,
        p_parent_id: id,
        p_parent_level: newLevel,
      });
      if (cascadeError) return { success: false, error: cascadeError.message };
    }

    return { success: true, data: data as WarehouseLocation };
  }

  /**
   * Soft-delete a location by calling the `soft_delete_warehouse_location` DB RPC.
   *
   * The RPC atomically reparents direct children to root (parent_id = NULL,
   * level = 0), cascades corrected levels to all grandchildren, and then sets
   * deleted_at on the target — all in one transaction.
   */
  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase.rpc("soft_delete_warehouse_location", {
      p_org_id: orgId,
      p_location_id: id,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Batch-update sort_order for a set of sibling locations.
   * All items must belong to the same org/branch (enforced by the WHERE clause).
   */
  static async reorderBatch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    items: { id: string; sort_order: number }[]
  ): Promise<ServiceResult<void>> {
    const results = await Promise.all(
      items.map(({ id, sort_order }) =>
        supabase
          .from("warehouse_locations")
          .update({ sort_order, updated_at: new Date().toISOString() })
          .eq("id", id)
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .is("deleted_at", null)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) return { success: false, error: failed.error.message };
    return { success: true, data: undefined };
  }

  // ─── V2 Methods ─────────────────────────────────────────────────────────────

  /**
   * Calls the validate_warehouse_location_archive RPC.
   * Read-only — never mutates. Returns typed ArchiveValidationResult.
   */
  static async validateArchive(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string
  ): Promise<ServiceResult<ArchiveValidationResult>> {
    const { data, error } = await supabase.rpc("validate_warehouse_location_archive", {
      p_location_id: locationId,
    });
    if (error) return { success: false, error: error.message };
    const result = data as ArchiveValidationResult;
    if (!result?.location_id) return { success: false, error: "Unexpected RPC response" };
    // Verify the returned location belongs to the expected org (fail-closed)
    const locResult = await supabase
      .from("warehouse_locations")
      .select("id, organization_id")
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (locResult.error) return { success: false, error: locResult.error.message };
    if (!locResult.data) return { success: false, error: "Location not found" };
    return { success: true, data: result };
  }

  /**
   * Archives a location (status = 'archived').
   * Validates blockers first. Returns failure with blockers if any exist.
   * Does NOT hard-delete, does NOT modify stock, does NOT delete visual nodes.
   */
  static async archiveLocation(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string,
    userId?: string
  ): Promise<ServiceResult<{ archived: true; warnings: ArchiveValidationResult["warnings"] }>> {
    const validation = await WarehouseLocationsService.validateArchive(supabase, orgId, locationId);
    if (!validation.success) return { success: false as const, error: validation.error };
    if (!validation.data.can_archive) {
      return {
        success: false,
        error: `Cannot archive: ${validation.data.blockers.map((b) => b.message).join("; ")}`,
      };
    }
    const update: Record<string, unknown> = {
      status: "archived" as LocationStatus,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { error } = await supabase
      .from("warehouse_locations")
      .update(update)
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: { archived: true, warnings: validation.data.warnings } };
  }

  /**
   * Calls get_warehouse_location_mapping_status RPC.
   * Returns typed MappingStatusResult.
   */
  static async getMappingStatus(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string
  ): Promise<ServiceResult<MappingStatusResult>> {
    // Verify org ownership before calling RPC
    const locResult = await supabase
      .from("warehouse_locations")
      .select("id, organization_id")
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (locResult.error) return { success: false, error: locResult.error.message };
    if (!locResult.data) return { success: false, error: "Location not found" };

    const { data, error } = await supabase.rpc("get_warehouse_location_mapping_status", {
      p_location_id: locationId,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as MappingStatusResult };
  }

  /**
   * Updates can_store_inventory for a location.
   * Explicit, auditable — does not silently affect stock.
   */
  static async updateStorageCapability(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string,
    canStoreInventory: boolean,
    userId?: string
  ): Promise<ServiceResult<void>> {
    const update: Record<string, unknown> = {
      can_store_inventory: canStoreInventory,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { error } = await supabase
      .from("warehouse_locations")
      .update(update)
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Updates width_mm/height_mm/depth_mm. Validates positive integers or null.
   */
  static async updateDimensions(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string,
    dimensions: { width_mm?: number | null; height_mm?: number | null; depth_mm?: number | null },
    userId?: string
  ): Promise<ServiceResult<void>> {
    for (const [key, val] of Object.entries(dimensions)) {
      if (val !== null && val !== undefined && (!Number.isInteger(val) || val <= 0)) {
        return { success: false, error: `${key} must be a positive integer` };
      }
    }
    const update: Record<string, unknown> = {
      ...dimensions,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { error } = await supabase
      .from("warehouse_locations")
      .update(update)
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Updates V2 fields on an existing location.
   * Merges safely alongside legacy fields — does not overwrite map_role etc.
   */
  static async updateV2Fields(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string,
    input: UpdateLocationV2Input,
    userId?: string
  ): Promise<ServiceResult<LocationV2>> {
    const V2_COLUMNS =
      "id, organization_id, branch_id, parent_id, name, code, description, icon_name, color, " +
      "inherit_group_color, inherit_parent_color, can_store_inventory, status, location_category, " +
      "width_mm, height_mm, depth_mm, level, sort_order, qr_code, created_by, updated_by, created_at, updated_at, deleted_at";

    if (input.width_mm !== undefined && input.width_mm !== null) {
      if (!Number.isInteger(input.width_mm) || input.width_mm <= 0)
        return { success: false, error: "width_mm must be a positive integer" };
    }
    if (input.height_mm !== undefined && input.height_mm !== null) {
      if (!Number.isInteger(input.height_mm) || input.height_mm <= 0)
        return { success: false, error: "height_mm must be a positive integer" };
    }
    if (input.depth_mm !== undefined && input.depth_mm !== null) {
      if (!Number.isInteger(input.depth_mm) || input.depth_mm <= 0)
        return { success: false, error: "depth_mm must be a positive integer" };
    }

    const update: Record<string, unknown> = {
      ...input,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;

    const { data, error } = await supabase
      .from("warehouse_locations")
      .update(update)
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(V2_COLUMNS)
      .single();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Location not found" };
    return { success: true, data: data as unknown as LocationV2 };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Detect whether reparenting `nodeId` to `newParentId` would create a cycle.
   *
   * Walks up the ancestor chain from `newParentId`. If `nodeId` appears in that
   * chain, a cycle would be created (A → newParent → ... → A).
   *
   * Caps traversal at `maxDepth` to guard against pre-existing corrupt data.
   * Returns { success: true, data: true } if a cycle would be created.
   */
  private static async wouldCreateCycle(
    supabase: SupabaseClient,
    orgId: string,
    nodeId: string,
    newParentId: string,
    maxDepth = 50
  ): Promise<ServiceResult<boolean>> {
    let currentId: string | null = newParentId;
    let depth = 0;

    while (currentId !== null && depth < maxDepth) {
      if (currentId === nodeId) {
        return { success: true, data: true };
      }
      const result = await WarehouseLocationsService.getById(supabase, orgId, currentId);
      if (result.success === false) return { success: false as const, error: result.error };
      if (!result.data) break; // reached a root or a detached node — no cycle
      currentId = result.data.parent_id;
      depth++;
    }

    return { success: true, data: false };
  }

  private static async validateGroupAssignment(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    parentId: string | null,
    groupId: string | null
  ): Promise<ServiceResult<void>> {
    if (!groupId) return { success: true, data: undefined };

    const { data, error } = await supabase
      .from("warehouse_location_groups")
      .select(GROUP_SCOPE_COLUMNS)
      .eq("id", groupId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Location group not found" };

    const group = data as {
      id: string;
      organization_id: string;
      branch_id: string;
      parent_location_id: string | null;
      deleted_at: string | null;
    };

    if (group.branch_id !== branchId) {
      return { success: false, error: "Location group belongs to a different branch" };
    }

    if (group.parent_location_id !== parentId) {
      return {
        success: false,
        error: "Location group belongs to a different parent location",
      };
    }

    return { success: true, data: undefined };
  }

  private static async validateFrontSegmentHeight(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: {
      locationId: string | null;
      parentId: string | null;
      mapRole: WarehouseLocation["map_role"];
      physicalHeightM: number | null;
    }
  ): Promise<ServiceResult<void>> {
    if (input.mapRole !== "front_segment" && input.mapRole !== "top_storage_segment") {
      return { success: true, data: undefined };
    }

    const isTopStorageSegment = input.mapRole === "top_storage_segment";

    if (!input.parentId) {
      return {
        success: false,
        error: isTopStorageSegment
          ? "Top storage segments must belong directly to a top-down unit"
          : "Front segments must belong directly to a top-down unit",
      };
    }

    if (input.physicalHeightM === null) {
      return {
        success: false,
        error: isTopStorageSegment
          ? "Top storage segments require an explicit height"
          : "Front segments require an explicit height",
      };
    }

    const parentResult = await WarehouseLocationsService.getById(supabase, orgId, input.parentId);
    if (parentResult.success === false) return { success: false, error: parentResult.error };
    if (!parentResult.data) {
      return { success: false, error: "Parent location not found" };
    }
    if (parentResult.data.branch_id !== branchId) {
      return { success: false, error: "Parent location belongs to a different branch" };
    }
    if ((parentResult.data.map_role ?? "logical") !== "top_down_unit") {
      return {
        success: false,
        error: isTopStorageSegment
          ? "Top storage segments must belong directly to a top-down unit"
          : "Front segments must belong directly to a top-down unit",
      };
    }

    if (isTopStorageSegment && !parentResult.data.allow_top_storage) {
      return {
        success: false,
        error: "The parent top-down unit does not allow top storage",
      };
    }

    if (parentResult.data.physical_height_m === null) {
      if (!isTopStorageSegment) {
        return { success: true, data: undefined };
      }
      return { success: true, data: undefined };
    }

    const siblingsResult = await WarehouseLocationsService.getChildren(
      supabase,
      orgId,
      input.parentId
    );
    if (siblingsResult.success === false) return { success: false, error: siblingsResult.error };

    if (isTopStorageSegment) {
      const duplicateTopStorage = siblingsResult.data.some(
        (child) =>
          child.id !== input.locationId && (child.map_role ?? "logical") === "top_storage_segment"
      );
      if (duplicateTopStorage) {
        return {
          success: false,
          error: "Only one top storage segment is allowed per top-down unit",
        };
      }

      return { success: true, data: undefined };
    }

    const usedHeight = siblingsResult.data
      .filter((child) => child.id !== input.locationId)
      .filter((child) => (child.map_role ?? "logical") === "front_segment")
      .reduce((sum, child) => sum + (child.physical_height_m ?? 0), 0);

    const availableHeight = Math.max(
      0,
      Math.round((parentResult.data.physical_height_m - usedHeight) * 1e4) / 1e4
    );
    if (Math.round(input.physicalHeightM * 1e4) / 1e4 > availableHeight) {
      return {
        success: false,
        error: isTopStorageSegment
          ? `Top storage height exceeds available parent height (${availableHeight} m remaining of ${parentResult.data.physical_height_m} m)`
          : `Front segment height exceeds available parent height (${availableHeight} m remaining of ${parentResult.data.physical_height_m} m)`,
      };
    }

    return { success: true, data: undefined };
  }
}
