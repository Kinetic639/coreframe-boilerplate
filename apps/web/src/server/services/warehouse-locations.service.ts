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
  sort_order?: number;
}

export interface UpdateLocationInput {
  name?: string;
  code?: string | null;
  description?: string | null;
  icon_name?: string | null;
  color?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

// ─── Column select ────────────────────────────────────────────────────────────

const LOCATION_COLUMNS =
  "id, organization_id, branch_id, name, code, description, icon_name, color, parent_id, level, sort_order, qr_code, created_by, updated_by, created_at, updated_at, deleted_at" as const;

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

    // If the node's level changed, cascade the new level values to all descendants.
    if (newLevel !== undefined && newLevel !== current.level) {
      const cascadeResult = await WarehouseLocationsService.cascadeDescendantLevels(
        supabase,
        orgId,
        id,
        newLevel
      );
      if (cascadeResult.success === false) return { success: false, error: cascadeResult.error };
    }

    return { success: true, data: data as WarehouseLocation };
  }

  /**
   * Soft-delete a location by setting deleted_at.
   *
   * Before deleting, direct children are explicitly reparented to root
   * (parent_id = NULL, level = 0). Their descendants' levels are then cascaded
   * so that all subtrees remain internally consistent.
   *
   * Note: the ON DELETE SET NULL FK on parent_id only fires for hard DELETEs —
   * it does NOT fire for this soft-delete UPDATE. Children are reparented
   * explicitly here to keep the DB state consistent.
   */
  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<void>> {
    // Step 1: Fetch direct children so we can cascade their descendants' levels.
    const childrenResult = await WarehouseLocationsService.getChildren(supabase, orgId, id);
    if (childrenResult.success === false) return { success: false, error: childrenResult.error };

    // Step 2: Reparent direct children to root (single batch UPDATE).
    if (childrenResult.data.length > 0) {
      const { error: reparentError } = await supabase
        .from("warehouse_locations")
        .update({ parent_id: null, level: 0 })
        .eq("organization_id", orgId)
        .eq("parent_id", id)
        .is("deleted_at", null);

      if (reparentError) return { success: false, error: reparentError.message };

      // Step 3: Cascade level=1 to grandchildren, level=2 to great-grandchildren, etc.
      for (const child of childrenResult.data) {
        const cascadeResult = await WarehouseLocationsService.cascadeDescendantLevels(
          supabase,
          orgId,
          child.id,
          0 // the child is now at level=0; cascade from level 0+1=1 downward
        );
        if (cascadeResult.success === false) return { success: false, error: cascadeResult.error };
      }
    }

    // Step 4: Soft-delete the location.
    const { error } = await supabase
      .from("warehouse_locations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
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

  /**
   * Recursively update the `level` field for all active descendants of `parentId`.
   *
   * Each child's level is set to parentLevel + 1. The update recurses depth-first.
   * Nodes whose level is already correct are still updated to keep the operation
   * idempotent and simple; the extra writes are cheap for typical tree sizes.
   */
  private static async cascadeDescendantLevels(
    supabase: SupabaseClient,
    orgId: string,
    parentId: string,
    parentLevel: number
  ): Promise<ServiceResult<void>> {
    const childrenResult = await WarehouseLocationsService.getChildren(supabase, orgId, parentId);
    if (childrenResult.success === false) return { success: false, error: childrenResult.error };
    if (childrenResult.data.length === 0) return { success: true, data: undefined };

    const childLevel = parentLevel + 1;

    for (const child of childrenResult.data) {
      const { error } = await supabase
        .from("warehouse_locations")
        .update({ level: childLevel })
        .eq("id", child.id)
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      const sub = await WarehouseLocationsService.cascadeDescendantLevels(
        supabase,
        orgId,
        child.id,
        childLevel
      );
      if (sub.success === false) return { success: false, error: sub.error };
    }

    return { success: true, data: undefined };
  }
}
