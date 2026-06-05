/**
 * Warehouse Layout Split Nodes Service
 *
 * Manages warehouse_layout_split_nodes — the interior/front-view
 * layout composition layer.
 *
 * Architecture invariants:
 * - Split nodes are layout composition, NOT inventory truth.
 * - Removing a split node never archives/deletes the linked location.
 * - Linking/unlinking a split node never modifies stock.
 * - Calculated geometry (calc_*_mm) is a cache. Source of truth is
 *   parent dimensions + split rules.
 * - Fail-closed: always returns ServiceResult<T>, never throws.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LayoutSplitNode,
  CreateSplitNodeInput,
  SplitNodeListOptions,
  SplitSizeMode,
} from "@/lib/types/warehouse/locations-v2";
import type { ServiceResult } from "./warehouse-locations.service";

// ─── Column select ────────────────────────────────────────────────────────────

const SPLIT_NODE_COLUMNS =
  "id, organization_id, branch_id, layout_id, view_context_location_id, " +
  "parent_visual_node_id, parent_node_id, node_kind, split_direction, size_mode, " +
  "size_value, sort_order, linked_location_id, calc_x_mm, calc_y_mm, calc_z_mm, " +
  "calc_width_mm, calc_height_mm, calc_depth_mm, cache_valid, " +
  "created_by, updated_by, created_at, updated_at, deleted_at";

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLayoutSplitNodesService {
  /**
   * List active split nodes for a layout.
   * Optionally filtered by parentVisualNodeId.
   */
  static async listByLayout(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    options: SplitNodeListOptions = {}
  ): Promise<ServiceResult<LayoutSplitNode[]>> {
    let query = supabase
      .from("warehouse_layout_split_nodes")
      .select(SPLIT_NODE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("layout_id", layoutId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });

    if (options.parentVisualNodeId !== undefined) {
      if (options.parentVisualNodeId === null) {
        query = query.is("parent_visual_node_id", null);
      } else {
        query = query.eq("parent_visual_node_id", options.parentVisualNodeId);
      }
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as unknown as LayoutSplitNode[] };
  }

  /**
   * List active split nodes scoped to a specific parent visual node.
   */
  static async listByParentVisualNode(
    supabase: SupabaseClient,
    orgId: string,
    parentVisualNodeId: string
  ): Promise<ServiceResult<LayoutSplitNode[]>> {
    const { data, error } = await supabase
      .from("warehouse_layout_split_nodes")
      .select(SPLIT_NODE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("parent_visual_node_id", parentVisualNodeId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as unknown as LayoutSplitNode[] };
  }

  /**
   * Create a split node.
   * Validates parent visual node and layout belong to the same org/branch.
   * Invalidates cache_valid for the parent tree after structural change.
   */
  static async createSplit(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    layoutId: string,
    input: CreateSplitNodeInput,
    userId?: string
  ): Promise<ServiceResult<LayoutSplitNode>> {
    // Verify layout ownership
    const layoutCheck = await supabase
      .from("warehouse_layouts")
      .select("id, branch_id")
      .eq("id", layoutId)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (layoutCheck.error) return { success: false, error: layoutCheck.error.message };
    if (!layoutCheck.data) return { success: false, error: "Layout not found in this org/branch" };

    // Verify parent visual node belongs to org/branch if provided
    if (input.parent_visual_node_id) {
      const pvnCheck = await supabase
        .from("warehouse_location_visual_nodes")
        .select("id, organization_id, branch_id")
        .eq("id", input.parent_visual_node_id)
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .maybeSingle();
      if (pvnCheck.error) return { success: false, error: pvnCheck.error.message };
      if (!pvnCheck.data)
        return { success: false, error: "Parent visual node not found in this org/branch" };
    }

    // Verify linked location belongs to org/branch if provided
    if (input.linked_location_id) {
      const locCheck = await supabase
        .from("warehouse_locations")
        .select("id")
        .eq("id", input.linked_location_id)
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .maybeSingle();
      if (locCheck.error) return { success: false, error: locCheck.error.message };
      if (!locCheck.data)
        return { success: false, error: "Linked location not found in this org/branch" };
    }

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      organization_id: orgId,
      branch_id: branchId,
      layout_id: layoutId,
      view_context_location_id: input.view_context_location_id ?? null,
      parent_visual_node_id: input.parent_visual_node_id ?? null,
      parent_node_id: input.parent_node_id ?? null,
      node_kind: input.node_kind,
      split_direction: input.split_direction ?? null,
      size_mode: input.size_mode ?? "equal",
      size_value: input.size_value ?? null,
      sort_order: input.sort_order ?? 0,
      linked_location_id: input.linked_location_id ?? null,
      cache_valid: false,
      created_at: now,
      updated_at: now,
    };
    if (userId) {
      row.created_by = userId;
      row.updated_by = userId;
    }

    const { data, error } = await supabase
      .from("warehouse_layout_split_nodes")
      .insert(row)
      .select(SPLIT_NODE_COLUMNS)
      .single();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Insert returned no data" };

    // Invalidate parent tree cache
    if (input.parent_node_id) {
      await WarehouseLayoutSplitNodesService.invalidateParentCache(
        supabase,
        orgId,
        input.parent_node_id
      );
    }

    return { success: true, data: data as unknown as LayoutSplitNode };
  }

  /**
   * Resize a split node: update size_mode and/or size_value.
   * Invalidates cache_valid for affected siblings/tree.
   */
  static async resizeSplit(
    supabase: SupabaseClient,
    orgId: string,
    nodeId: string,
    sizeMode: SplitSizeMode,
    sizeValue: number | null,
    userId?: string
  ): Promise<ServiceResult<LayoutSplitNode>> {
    // Validate size_value based on size_mode
    if ((sizeMode === "fixed" || sizeMode === "ratio") && (sizeValue === null || sizeValue <= 0)) {
      return {
        success: false,
        error: `size_value must be a positive number for mode '${sizeMode}'`,
      };
    }

    const update: Record<string, unknown> = {
      size_mode: sizeMode,
      size_value: sizeValue,
      cache_valid: false,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;

    const { data, error } = await supabase
      .from("warehouse_layout_split_nodes")
      .update(update)
      .eq("id", nodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(SPLIT_NODE_COLUMNS)
      .single();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Split node not found" };

    const typedNode = data as unknown as LayoutSplitNode;
    if (typedNode.parent_node_id) {
      await WarehouseLayoutSplitNodesService.invalidateParentCache(
        supabase,
        orgId,
        typedNode.parent_node_id
      );
    }

    return { success: true, data: typedNode };
  }

  /**
   * Soft-delete a split node.
   * Does NOT archive or delete the linked location.
   * Does NOT move stock.
   * Children split nodes cascade-delete via DB FK (ON DELETE CASCADE).
   */
  static async removeSplitNode(
    supabase: SupabaseClient,
    orgId: string,
    nodeId: string,
    userId?: string
  ): Promise<ServiceResult<void>> {
    const update: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { error } = await supabase
      .from("warehouse_layout_split_nodes")
      .update(update)
      .eq("id", nodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Link a split cell to a warehouse location.
   * Validates location belongs to the same org/branch as the split node.
   * Does NOT change inventory, stock, or location status.
   */
  static async linkLocation(
    supabase: SupabaseClient,
    orgId: string,
    splitNodeId: string,
    locationId: string,
    userId?: string
  ): Promise<ServiceResult<LayoutSplitNode>> {
    // Fetch split node to verify org + get branch_id
    const { data: splitNode, error: splitError } = await supabase
      .from("warehouse_layout_split_nodes")
      .select("id, organization_id, branch_id")
      .eq("id", splitNodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (splitError) return { success: false, error: splitError.message };
    if (!splitNode) return { success: false, error: "Split node not found" };

    // Verify location belongs to same org/branch
    const locCheck = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .eq("branch_id", (splitNode as { branch_id: string }).branch_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (locCheck.error) return { success: false, error: locCheck.error.message };
    if (!locCheck.data)
      return { success: false, error: "Location not found in split node's org/branch" };

    const update: Record<string, unknown> = {
      linked_location_id: locationId,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;

    const { data, error } = await supabase
      .from("warehouse_layout_split_nodes")
      .update(update)
      .eq("id", splitNodeId)
      .eq("organization_id", orgId)
      .select(SPLIT_NODE_COLUMNS)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as unknown as LayoutSplitNode };
  }

  /**
   * Unlink location from a split cell.
   * Does NOT delete or archive the location.
   * Does NOT move stock.
   */
  static async unlinkLocation(
    supabase: SupabaseClient,
    orgId: string,
    splitNodeId: string,
    userId?: string
  ): Promise<ServiceResult<LayoutSplitNode>> {
    const update: Record<string, unknown> = {
      linked_location_id: null,
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { data, error } = await supabase
      .from("warehouse_layout_split_nodes")
      .update(update)
      .eq("id", splitNodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(SPLIT_NODE_COLUMNS)
      .single();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Split node not found" };
    return { success: true, data: data as unknown as LayoutSplitNode };
  }

  /**
   * Recalculate split tree positions from the given root node down.
   *
   * The calculated geometry is a cache derived from:
   *   parent dimensions + split rules + sort_order
   *
   * This is a Phase 2 stub — the full recursive calculator is a Phase 4+ concern.
   * For now it marks all descendants cache_valid=false so callers know recalc is needed.
   */
  static async recalculatePositions(
    supabase: SupabaseClient,
    orgId: string,
    rootNodeId: string
  ): Promise<ServiceResult<{ invalidated_count: number }>> {
    // Fetch the root node to get its calc dimensions as the starting envelope
    const { data: root, error: rootError } = await supabase
      .from("warehouse_layout_split_nodes")
      .select(SPLIT_NODE_COLUMNS)
      .eq("id", rootNodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (rootError) return { success: false, error: rootError.message };
    if (!root) return { success: false, error: "Root split node not found" };

    // Phase 2 TODO: implement full recursive geometry calculator.
    // For now, mark all children cache_valid=false so the UI knows to re-request.
    const { data: invalidated, error } = await supabase
      .from("warehouse_layout_split_nodes")
      .update({ cache_valid: false, updated_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("layout_id", (root as unknown as LayoutSplitNode).layout_id)
      .is("deleted_at", null)
      .select("id");
    if (error) return { success: false, error: error.message };
    return { success: true, data: { invalidated_count: invalidated?.length ?? 0 } };
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private static async invalidateParentCache(
    supabase: SupabaseClient,
    orgId: string,
    parentNodeId: string
  ): Promise<void> {
    await supabase
      .from("warehouse_layout_split_nodes")
      .update({ cache_valid: false, updated_at: new Date().toISOString() })
      .eq("id", parentNodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
  }
}
