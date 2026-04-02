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
   * Useful for lazy-loading tree nodes.
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
   * If parent_id changes, level is recomputed from the new parent.
   * The location must belong to the given org.
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

    if (input.parent_id !== undefined) {
      if (input.parent_id === id) {
        return { success: false, error: "A location cannot be its own parent" };
      }
      updatePayload.parent_id = input.parent_id;

      if (input.parent_id === null) {
        updatePayload.level = 0;
      } else {
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
        updatePayload.level = newParentResult.data.level + 1;
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

    return { success: true, data: data as WarehouseLocation };
  }

  /**
   * Soft-delete a location by setting deleted_at.
   * Children whose parent_id points to this location will have parent_id set to NULL
   * by the ON DELETE SET NULL FK constraint — they become root nodes.
   */
  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("warehouse_locations")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
