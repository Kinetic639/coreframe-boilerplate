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
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.description !== undefined) patch.description = input.description;
    if (input.color !== undefined) patch.color = input.color;
    if (input.sort_order !== undefined) patch.sort_order = input.sort_order;
    if (input.parent_location_id !== undefined) patch.parent_location_id = input.parent_location_id;

    if (Object.keys(patch).length === 0) {
      const existing = await this.getById(supabase, orgId, groupId);
      if (!existing.success || !existing.data) return { success: false, error: "Group not found" };
      return { success: true, data: existing.data };
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
    const updates = items.map(({ id, sort_order }) =>
      supabase
        .from("warehouse_location_groups")
        .update({ sort_order })
        .eq("id", id)
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .is("deleted_at", null)
    );

    const results = await Promise.all(updates);
    const firstError = results.find((r) => r.error)?.error;
    if (firstError) return { success: false, error: firstError.message };
    return { success: true, data: undefined };
  }

  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    groupId: string
  ): Promise<ServiceResult<void>> {
    // Clear group_id from all member locations first
    const { error: clearErr } = await supabase
      .from("warehouse_locations")
      .update({ group_id: null })
      .eq("group_id", groupId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (clearErr) return { success: false, error: clearErr.message };

    // Soft-delete the group
    const { error } = await supabase
      .from("warehouse_location_groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", groupId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
