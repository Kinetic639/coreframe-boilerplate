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
  sort_order?: number;
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
  sort_order?: number;
}

// ─── Column select ────────────────────────────────────────────────────────────

const LOCATION_COLUMNS =
  "id, organization_id, branch_id, name, code, description, icon_name, color, parent_id, group_id, inherit_group_color, level, sort_order, qr_code, created_by, updated_by, created_at, updated_at, deleted_at" as const;

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
        level,
        sort_order: input.sort_order ?? 0,
        created_by: userId,
        updated_by: userId,
      })
      .select(LOCATION_COLUMNS)
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "A location with this code already exists in this branch",
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
    const effectiveGroupId = input.group_id !== undefined ? input.group_id : current.group_id;
    const effectiveInheritGroupColor =
      input.inherit_group_color !== undefined
        ? input.inherit_group_color
        : current.inherit_group_color;
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
          error: "A location with this code already exists in this branch",
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
}
