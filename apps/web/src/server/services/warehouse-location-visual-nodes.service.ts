/**
 * Warehouse Location Visual Nodes Service
 *
 * Manages warehouse_location_visual_nodes — the visual representation layer.
 *
 * Architecture invariants:
 * - Visual nodes are SEPARATE from inventory. Deleting a visual node never
 *   deletes or archives the linked location.
 * - Inventory (warehouse_locations) never depends on visual nodes.
 * - Scope: every query is bounded by organization_id. Branch is derived from
 *   the location or layout record — never accepted blindly from the caller.
 * - Fail-closed: always returns ServiceResult<T>, never throws to callers.
 * - batch operations are scoped — never silently delete outside scope.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LocationVisualNode,
  UpsertVisualNodeInput,
  VisualNodeListOptions,
  ViewType,
  LocationV2,
} from "@/lib/types/warehouse/locations-v2";
import type { ServiceResult } from "./warehouse-locations.service";

// ─── Column select ────────────────────────────────────────────────────────────

const VISUAL_NODE_COLUMNS =
  "id, organization_id, branch_id, layout_id, location_id, view_type, " +
  "view_context_location_id, visualization_type, visual_role, status, " +
  "x_mm, y_mm, z_mm, width_mm, height_mm, depth_mm, rotation_deg, style, " +
  "z_index, sort_order, created_by, updated_by, created_at, updated_at, deleted_at";

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLocationVisualNodesService {
  /**
   * List all active visual nodes for a layout.
   * Optionally filtered by view_type and/or view_context_location_id.
   */
  static async listByLayout(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    options: VisualNodeListOptions = {}
  ): Promise<ServiceResult<LocationVisualNode[]>> {
    let query = supabase
      .from("warehouse_location_visual_nodes")
      .select(VISUAL_NODE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("layout_id", layoutId)
      .is("deleted_at", null)
      .order("z_index", { ascending: true })
      .order("sort_order", { ascending: true });

    if (!options.includeHidden) {
      query = query.eq("status", "active");
    }
    if (options.viewType) {
      query = query.eq("view_type", options.viewType);
    }
    if (options.viewContextLocationId !== undefined) {
      if (options.viewContextLocationId === null) {
        query = query.is("view_context_location_id", null);
      } else {
        query = query.eq("view_context_location_id", options.viewContextLocationId);
      }
    }

    const { data, error } = await query;
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as unknown as LocationVisualNode[] };
  }

  /**
   * List all non-deleted visual nodes for a specific location.
   */
  static async listByLocation(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string
  ): Promise<ServiceResult<LocationVisualNode[]>> {
    const { data, error } = await supabase
      .from("warehouse_location_visual_nodes")
      .select(VISUAL_NODE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("location_id", locationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as unknown as LocationVisualNode[] };
  }

  /**
   * Scoped query for editor context: layout + view_type + optional view_context.
   */
  static async listByContext(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    viewType: ViewType,
    viewContextLocationId?: string | null
  ): Promise<ServiceResult<LocationVisualNode[]>> {
    return WarehouseLocationVisualNodesService.listByLayout(supabase, orgId, layoutId, {
      viewType,
      viewContextLocationId,
    });
  }

  /**
   * Insert or update a single visual node.
   * Validates org/branch scope for location and layout.
   * Does not touch inventory.
   */
  static async upsertNode(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: UpsertVisualNodeInput,
    userId?: string
  ): Promise<ServiceResult<LocationVisualNode>> {
    // Verify location belongs to org/branch
    const locCheck = await supabase
      .from("warehouse_locations")
      .select("id, branch_id")
      .eq("id", input.location_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (locCheck.error) return { success: false, error: locCheck.error.message };
    if (!locCheck.data) return { success: false, error: "Location not found in this org/branch" };

    // Verify layout belongs to org/branch
    const layoutCheck = await supabase
      .from("warehouse_layouts")
      .select("id, branch_id")
      .eq("id", input.layout_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .maybeSingle();
    if (layoutCheck.error) return { success: false, error: layoutCheck.error.message };
    if (!layoutCheck.data) return { success: false, error: "Layout not found in this org/branch" };

    // Verify view_context_location belongs to org/branch if provided
    if (input.view_context_location_id) {
      const ctxCheck = await supabase
        .from("warehouse_locations")
        .select("id")
        .eq("id", input.view_context_location_id)
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .maybeSingle();
      if (ctxCheck.error) return { success: false, error: ctxCheck.error.message };
      if (!ctxCheck.data)
        return { success: false, error: "view_context_location not found in this org/branch" };
    }

    const now = new Date().toISOString();
    const row: Record<string, unknown> = {
      organization_id: orgId,
      branch_id: branchId,
      layout_id: input.layout_id,
      location_id: input.location_id,
      view_type: input.view_type,
      view_context_location_id: input.view_context_location_id ?? null,
      visualization_type: input.visualization_type ?? "rectangle",
      visual_role: input.visual_role ?? "primary",
      status: "active",
      x_mm: input.x_mm,
      y_mm: input.y_mm,
      z_mm: input.z_mm ?? 0,
      width_mm: input.width_mm,
      height_mm: input.height_mm,
      depth_mm: input.depth_mm ?? null,
      rotation_deg: input.rotation_deg ?? 0,
      style: input.style ?? null,
      z_index: input.z_index ?? 0,
      sort_order: input.sort_order ?? 0,
      updated_at: now,
    };
    if (userId) row.updated_by = userId;

    let result;
    if (input.id) {
      // Update existing node
      const { data, error } = await supabase
        .from("warehouse_location_visual_nodes")
        .update(row)
        .eq("id", input.id)
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .select(VISUAL_NODE_COLUMNS)
        .single();
      if (error) return { success: false, error: error.message };
      result = data;
    } else {
      // Insert new node
      row.created_at = now;
      if (userId) row.created_by = userId;
      const { data, error } = await supabase
        .from("warehouse_location_visual_nodes")
        .insert(row)
        .select(VISUAL_NODE_COLUMNS)
        .single();
      if (error) return { success: false, error: error.message };
      result = data;
    }

    if (!result) return { success: false, error: "Upsert returned no data" };
    return { success: true, data: result as unknown as LocationVisualNode };
  }

  /**
   * Soft-delete a single visual node.
   * Does NOT delete or archive the linked location.
   * Does NOT move stock.
   */
  static async softDeleteNode(
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
      .from("warehouse_location_visual_nodes")
      .update(update)
      .eq("id", nodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Hide a node (status = 'hidden') without deleting it.
   */
  static async hideNode(
    supabase: SupabaseClient,
    orgId: string,
    nodeId: string,
    userId?: string
  ): Promise<ServiceResult<void>> {
    const update: Record<string, unknown> = {
      status: "hidden",
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { error } = await supabase
      .from("warehouse_location_visual_nodes")
      .update(update)
      .eq("id", nodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Restore a hidden node back to active.
   * If the primary unique index would be violated, returns a failure
   * rather than silently overwriting the existing primary node.
   */
  static async restoreNode(
    supabase: SupabaseClient,
    orgId: string,
    nodeId: string,
    userId?: string
  ): Promise<ServiceResult<LocationVisualNode>> {
    // Fetch the node first to check for uniqueness conflict
    const { data: node, error: fetchError } = await supabase
      .from("warehouse_location_visual_nodes")
      .select(VISUAL_NODE_COLUMNS)
      .eq("id", nodeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (fetchError) return { success: false, error: fetchError.message };
    if (!node) return { success: false, error: "Visual node not found" };

    const typedNode = node as unknown as LocationVisualNode;
    if (typedNode.status === "active") return { success: true, data: typedNode };

    // Check for conflicting active primary in the same scope
    if (typedNode.visual_role === "primary") {
      const { data: conflict } = await supabase
        .from("warehouse_location_visual_nodes")
        .select("id")
        .eq("location_id", typedNode.location_id)
        .eq("view_type", typedNode.view_type)
        .eq("layout_id", typedNode.layout_id)
        .eq("visual_role", "primary")
        .eq("status", "active")
        .is("deleted_at", null)
        .maybeSingle();
      if (conflict) {
        return {
          success: false,
          error:
            "A primary visual node already exists for this location/view/layout. Hide or remove it first.",
        };
      }
    }

    const update: Record<string, unknown> = {
      status: "active",
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;
    const { data, error } = await supabase
      .from("warehouse_location_visual_nodes")
      .update(update)
      .eq("id", nodeId)
      .eq("organization_id", orgId)
      .select(VISUAL_NODE_COLUMNS)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as unknown as LocationVisualNode };
  }

  /**
   * Soft-delete all visual nodes for a location.
   * Optionally scoped to a specific layout, viewType, or view_context.
   *
   * IMPORTANT: This removes visual representation only.
   * It does NOT archive, delete, or modify the location or its stock.
   */
  static async softDeleteAllForLocation(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string,
    options: { layoutId?: string; viewType?: ViewType; viewContextLocationId?: string | null } = {},
    userId?: string
  ): Promise<ServiceResult<{ deleted_count: number }>> {
    // Verify the location belongs to this org
    const locCheck = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();
    if (locCheck.error) return { success: false, error: locCheck.error.message };
    if (!locCheck.data) return { success: false, error: "Location not found" };

    const update: Record<string, unknown> = {
      deleted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (userId) update.updated_by = userId;

    let query = supabase
      .from("warehouse_location_visual_nodes")
      .update(update)
      .eq("location_id", locationId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (options.layoutId) query = query.eq("layout_id", options.layoutId);
    if (options.viewType) query = query.eq("view_type", options.viewType);
    if (options.viewContextLocationId !== undefined) {
      if (options.viewContextLocationId === null) {
        query = query.is("view_context_location_id", null);
      } else {
        query = query.eq("view_context_location_id", options.viewContextLocationId);
      }
    }

    const { data: deleted, error } = await query.select("id");
    if (error) return { success: false, error: error.message };
    return { success: true, data: { deleted_count: deleted?.length ?? 0 } };
  }

  /**
   * Batch upsert visual nodes.
   *
   * SCOPE SAFETY: By default, only upserts the given nodes.
   * If replaceScope=true, soft-deletes nodes within the exact scope
   * (layout_id + view_type + view_context_location_id) that are NOT in the
   * input list. This must be explicitly requested — no silent destructive behavior.
   */
  static async batchUpsert(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    layoutId: string,
    inputs: UpsertVisualNodeInput[],
    options: {
      replaceScope?: boolean;
      viewType?: ViewType;
      viewContextLocationId?: string | null;
    } = {},
    userId?: string
  ): Promise<ServiceResult<LocationVisualNode[]>> {
    const results: LocationVisualNode[] = [];

    for (const input of inputs) {
      const nodeResult = await WarehouseLocationVisualNodesService.upsertNode(
        supabase,
        orgId,
        branchId,
        { ...input, layout_id: layoutId },
        userId
      );
      if (!nodeResult.success)
        return { success: false as const, error: (nodeResult as { error: string }).error };
      results.push(nodeResult.data);
    }

    // Only soft-delete out-of-scope nodes if explicitly requested
    if (options.replaceScope && options.viewType !== undefined) {
      const inputIds = new Set(results.map((n) => n.id));
      const listResult = await WarehouseLocationVisualNodesService.listByContext(
        supabase,
        orgId,
        layoutId,
        options.viewType,
        options.viewContextLocationId
      );
      if (!listResult.success)
        return { success: false as const, error: (listResult as { error: string }).error };

      const toDelete = listResult.data.filter((n) => !inputIds.has(n.id));
      for (const node of toDelete) {
        const delResult = await WarehouseLocationVisualNodesService.softDeleteNode(
          supabase,
          orgId,
          node.id,
          userId
        );
        if (!delResult.success)
          return { success: false as const, error: (delResult as { error: string }).error };
      }
    }

    return { success: true, data: results };
  }

  /**
   * Returns locations with can_store_inventory=true that have no active
   * primary visual node in the given layout/context.
   * Unmapped is a valid state — this is for the editor's "unmapped" panel.
   */
  static async getUnmappedLocations(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    layoutId: string,
    options: { viewContextLocationId?: string | null } = {}
  ): Promise<ServiceResult<LocationV2[]>> {
    const V2_COLUMNS =
      "id, organization_id, branch_id, parent_id, name, code, description, icon_name, color, " +
      "inherit_group_color, inherit_parent_color, can_store_inventory, status, location_category, " +
      "width_mm, height_mm, depth_mm, level, sort_order, qr_code, created_by, updated_by, created_at, updated_at, deleted_at";

    // Fetch all storage-capable active locations in the branch
    const { data: locations, error: locError } = await supabase
      .from("warehouse_locations")
      .select(V2_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("can_store_inventory", true)
      .eq("status", "active")
      .is("deleted_at", null);
    if (locError) return { success: false, error: locError.message };
    if (!locations?.length) return { success: true, data: [] };

    // Fetch active primary nodes for this layout/context
    let nodeQuery = supabase
      .from("warehouse_location_visual_nodes")
      .select("location_id")
      .eq("organization_id", orgId)
      .eq("layout_id", layoutId)
      .eq("visual_role", "primary")
      .eq("status", "active")
      .is("deleted_at", null);

    if (options.viewContextLocationId !== undefined) {
      nodeQuery =
        options.viewContextLocationId === null
          ? nodeQuery.is("view_context_location_id", null)
          : nodeQuery.eq("view_context_location_id", options.viewContextLocationId);
    }

    const { data: nodes, error: nodeError } = await nodeQuery;
    if (nodeError) return { success: false, error: nodeError.message };

    const mappedIds = new Set((nodes ?? []).map((n: { location_id: string }) => n.location_id));
    const unmapped = (locations as unknown as LocationV2[]).filter((loc) => !mappedIds.has(loc.id));
    return { success: true, data: unmapped };
  }
}
