/**
 * Warehouse Location Groups Service
 *
 * Manages display-only group containers for warehouse locations.
 * Groups are purely cosmetic — they cluster sibling locations (e.g. bays of the
 * same rack) in the UI without being inventory entities themselves.
 *
 * Constraints:
 * - server-only (never import from client components)
 * - uses authenticated Supabase client only (no service role)
 * - never bypasses RLS
 * - fail-closed: returns ServiceResult<T>, never throws to callers
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WarehouseLocationGroup } from "@/lib/warehouse/location-tree";

export type { WarehouseLocationGroup } from "@/lib/warehouse/location-tree";
export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface CreateLocationGroupInput {
  name: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
  parent_location_id?: string | null;
}

export interface UpdateLocationGroupInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  sort_order?: number;
  parent_location_id?: string | null;
}

// ─── Column select ────────────────────────────────────────────────────────────

const GROUP_COLUMNS =
  "id, organization_id, branch_id, parent_location_id, name, description, color, sort_order, created_by, created_at, updated_at, deleted_at" as const;

const PARENT_LOCATION_SCOPE_COLUMNS = "id, organization_id, branch_id, deleted_at" as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLocationGroupsService {
  /**
   * List all active (non-deleted) groups for a specific branch.
   * Ordered by sort_order then name.
   */
  static async listByBranch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<WarehouseLocationGroup[]>> {
    const { data, error } = await supabase
      .from("warehouse_location_groups")
      .select(GROUP_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocationGroup[] };
  }

  /**
   * Get a single active group by ID, scoped to organization.
   */
  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    groupId: string
  ): Promise<ServiceResult<WarehouseLocationGroup | null>> {
    const { data, error } = await supabase
      .from("warehouse_location_groups")
      .select(GROUP_COLUMNS)
      .eq("id", groupId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocationGroup | null };
  }

  /**
   * Create a new location group.
   * sort_order defaults to the highest current sort_order + 1.
   */
  static async create(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: CreateLocationGroupInput,
    userId: string
  ): Promise<ServiceResult<WarehouseLocationGroup>> {
    const parentValidation = await this.validateParentLocationScope(
      supabase,
      orgId,
      branchId,
      input.parent_location_id ?? null
    );
    if (!parentValidation.success) {
      return {
        success: false,
        error: (parentValidation as { success: false; error: string }).error,
      };
    }

    // Compute next sort_order unless explicitly supplied
    let sortOrder = input.sort_order ?? 0;
    if (input.sort_order === undefined) {
      const { data: maxRow } = await supabase
        .from("warehouse_location_groups")
        .select("sort_order")
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxRow) sortOrder = (maxRow as { sort_order: number }).sort_order + 1;
    }

    const { data, error } = await supabase
      .from("warehouse_location_groups")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        name: input.name.trim(),
        description: input.description ?? null,
        color: input.color ?? null,
        sort_order: sortOrder,
        parent_location_id: input.parent_location_id ?? null,
        created_by: userId,
      })
      .select(GROUP_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocationGroup };
  }

  /**
   * Update an existing group. Scoped to organization — callers must verify
   * branch ownership before calling.
   */
  static async update(
    supabase: SupabaseClient,
    orgId: string,
    groupId: string,
    input: UpdateLocationGroupInput
  ): Promise<ServiceResult<WarehouseLocationGroup>> {
    const current = await this.getById(supabase, orgId, groupId);
    if (!current.success) return current;
    if (!current.data) return { success: false, error: "Group not found" };

    const parentValidation = await this.validateParentLocationScope(
      supabase,
      orgId,
      current.data.branch_id,
      input.parent_location_id !== undefined
        ? (input.parent_location_id ?? null)
        : current.data.parent_location_id
    );
    if (!parentValidation.success) {
      return {
        success: false,
        error: (parentValidation as { success: false; error: string }).error,
      };
    }

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.color !== undefined) patch.color = input.color;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
    if (input.parent_location_id !== undefined) patch.parent_location_id = input.parent_location_id;

    if (Object.keys(patch).length === 0) {
      return { success: true, data: current.data };
    }

    const { data, error } = await supabase
      .from("warehouse_location_groups")
      .update(patch)
      .eq("id", groupId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(GROUP_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLocationGroup };
  }

  /**
   * Soft-delete a group.
   * Locations in the group retain their group_id FK — the ON DELETE SET NULL
   * only fires on hard-delete which is blocked by RLS. The soft-delete here
   * hides the group from UI; locations will appear as ungrouped on next load.
   * To avoid orphaned group_id references, we explicitly clear group_id on all
   * active member locations before soft-deleting the group.
   */
  /**
   * Batch-update sort_order for multiple groups.
   * Used for drag-to-reorder. Each item must belong to the same org+branch.
   */
  static async reorderBatch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    items: { id: string; sort_order: number }[]
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase.rpc("reorder_warehouse_location_groups", {
      p_org_id: orgId,
      p_branch_id: branchId,
      p_items: items,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    groupId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase.rpc("soft_delete_warehouse_location_group", {
      p_org_id: orgId,
      p_group_id: groupId,
    });

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  private static async validateParentLocationScope(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    parentLocationId: string | null
  ): Promise<ServiceResult<void>> {
    if (!parentLocationId) return { success: true, data: undefined };

    const { data, error } = await supabase
      .from("warehouse_locations")
      .select(PARENT_LOCATION_SCOPE_COLUMNS)
      .eq("id", parentLocationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Parent location not found" };

    const parent = data as {
      id: string;
      organization_id: string;
      branch_id: string;
      deleted_at: string | null;
    };

    if (parent.branch_id !== branchId) {
      return { success: false, error: "Parent location belongs to a different branch" };
    }

    return { success: true, data: undefined };
  }
}
