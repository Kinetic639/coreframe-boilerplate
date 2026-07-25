/**
 * Warehouse Layout Shapes Service
 *
 * Manages the individual canvas elements (shapes) within a warehouse layout.
 * Shapes are the visual building blocks: location markers, walls, doors,
 * aisles, zones, obstacles, and text labels.
 *
 * Constraints:
 * - server-only (never import from client components)
 * - uses authenticated Supabase client only (no service role)
 * - never bypasses RLS
 * - fail-closed: returns ServiceResult<T>, never throws to callers
 *
 * Key design notes:
 * - V1: shapes are FLAT (no parent_shape_id). Shape nesting is deferred to v2.
 * - organization_id and branch_id are denormalized on every shape row.
 *   The service always copies these from the parent layout on insert — callers
 *   must not supply them directly in input types.
 * - batchSave() is the primary editor save path. It takes the full canonical
 *   shape state for a layout and:
 *     1. Soft-deletes shapes present in DB but absent from the input list
 *     2. Upserts all shapes in the input list (insert new, update existing)
 *   This "replace active shapes" semantic keeps the editor stateless — it
 *   always sends the complete current canvas state on save.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WarehouseLayoutShape, ShapeUpsertInput } from "@/lib/warehouse/layouts";

export type { WarehouseLayoutShape, ShapeUpsertInput } from "@/lib/warehouse/layouts";
export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

// ─── Column select ─────────────────────────────────────────────────────────

const SHAPE_COLUMNS =
  "id, layout_id, organization_id, branch_id, shape_type, projection, anchor_location_id, location_id, label, x, y, width, height, rotation, style, z_index, sort_order, created_by, created_at, updated_at, deleted_at" as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLayoutShapesService {
  /**
   * Get a single active shape by ID, scoped to organization.
   * Returns null when the shape does not exist or is not visible to the caller.
   */
  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    shapeId: string
  ): Promise<ServiceResult<WarehouseLayoutShape | null>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .select(SHAPE_COLUMNS)
      .eq("id", shapeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayoutShape | null };
  }

  /**
   * List all active (non-deleted) shapes for a layout, ordered by z_index then sort_order.
   * Verifies the layout belongs to the given org.
   */
  static async listByLayout(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string
  ): Promise<ServiceResult<WarehouseLayoutShape[]>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .select(SHAPE_COLUMNS)
      .eq("layout_id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("z_index", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayoutShape[] };
  }

  static async listByLayoutAndProjection(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    projection: WarehouseLayoutShape["projection"]
  ): Promise<ServiceResult<WarehouseLayoutShape[]>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .select(SHAPE_COLUMNS)
      .eq("layout_id", layoutId)
      .eq("organization_id", orgId)
      .eq("projection", projection)
      .is("deleted_at", null)
      .order("z_index", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayoutShape[] };
  }

  static async listFrontElevationByAnchor(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    anchorLocationId: string
  ): Promise<ServiceResult<WarehouseLayoutShape[]>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .select(SHAPE_COLUMNS)
      .eq("layout_id", layoutId)
      .eq("organization_id", orgId)
      .eq("projection", "front_elevation")
      .eq("anchor_location_id", anchorLocationId)
      .is("deleted_at", null)
      .order("z_index", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayoutShape[] };
  }

  /**
   * Batch save — the primary editor save operation.
   *
   * Delegates to the `batch_save_warehouse_layout_shapes` DB RPC which runs the
   * full replace-active-shapes operation in a single transaction:
   *   1. Validates all location_ids belong to the same org+branch
   *   2. Soft-deletes shapes present in DB but absent from the input list
   *   3. Upserts all shapes in the input list (insert new, update existing,
   *      restore previously soft-deleted shapes re-added with the same id)
   *
   * Each shape in the input must carry a client-generated UUID as `id`.
   * Returns the full active shape list after the operation.
   */
  static async batchSave(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    layoutId: string,
    userId: string,
    shapes: ShapeUpsertInput[]
  ): Promise<ServiceResult<WarehouseLayoutShape[]>> {
    const { data, error } = await supabase.rpc("batch_save_warehouse_layout_shapes", {
      p_layout_id: layoutId,
      p_org_id: orgId,
      p_branch_id: branchId,
      p_user_id: userId,
      p_shapes: shapes as unknown as object,
    });

    if (error) {
      const msg = error.message ?? "";
      if (msg.includes("layout_not_found"))
        return { success: false, error: "Layout not found or does not belong to this branch" };
      if (msg.includes("cross_layout_id"))
        return {
          success: false,
          error: "One or more shape IDs already belong to a different layout",
        };
      if (msg.includes("invalid_location_id"))
        return {
          success: false,
          error:
            "One or more shapes reference a deleted or inaccessible location. Please remove those shapes and try again.",
        };
      return { success: false, error: error.message };
    }

    return { success: true, data: (data ?? []) as WarehouseLayoutShape[] };
  }

  /**
   * Upsert a single shape (for incremental saves, e.g. after a single drag-end).
   * org_id and branch_id must be supplied by the caller (copied from the layout).
   * If the shape links a location_id, validates it belongs to the same org+branch.
   */
  static async upsertOne(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    layoutId: string,
    userId: string,
    shape: ShapeUpsertInput
  ): Promise<ServiceResult<WarehouseLayoutShape>> {
    // Cross-layout ID guard: reject if this shape ID is already owned by a
    // different layout (active or soft-deleted — the ID is still claimed).
    const { data: existing, error: existErr } = await supabase
      .from("warehouse_layout_shapes")
      .select("layout_id")
      .eq("id", shape.id)
      .maybeSingle();

    if (existErr) return { success: false, error: existErr.message };
    if (existing && (existing as { layout_id: string }).layout_id !== layoutId) {
      return { success: false, error: "shape_id belongs to a different layout" };
    }

    // Validate location_id / anchor_location_id cross-branch before any write
    const scopedLocationIds = [shape.location_id ?? null, shape.anchor_location_id ?? null].filter(
      (value): value is string => typeof value === "string"
    );

    if (scopedLocationIds.length > 0) {
      const { data: loc, error: locErr } = await supabase
        .from("warehouse_locations")
        .select("id")
        .in("id", scopedLocationIds)
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .is("deleted_at", null);

      if (locErr) return { success: false, error: locErr.message };
      const resolvedIds = new Set((loc ?? []).map((row) => (row as { id: string }).id));
      if (scopedLocationIds.some((id) => !resolvedIds.has(id)))
        return {
          success: false,
          error: "location_id or anchor_location_id does not belong to this org/branch",
        };
    }

    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .upsert(
        {
          id: shape.id,
          layout_id: layoutId,
          organization_id: orgId,
          branch_id: branchId,
          shape_type: shape.shape_type,
          projection: shape.projection ?? "top_down",
          anchor_location_id: shape.anchor_location_id ?? null,
          location_id: shape.location_id ?? null,
          label: shape.label ?? null,
          x: shape.x,
          y: shape.y,
          width: shape.width,
          height: shape.height,
          rotation: shape.rotation,
          style: shape.style ?? null,
          z_index: shape.z_index ?? 0,
          sort_order: shape.sort_order ?? 0,
          created_by: userId,
          deleted_at: null,
        },
        { onConflict: "id", ignoreDuplicates: false }
      )
      .select(SHAPE_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayoutShape };
  }

  /**
   * Soft-delete a single shape by ID.
   * Verifies the shape belongs to the given org before deleting.
   */
  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    shapeId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("warehouse_layout_shapes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", shapeId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }

  /**
   * Find the shape that represents a specific warehouse location on any layout.
   * Returns the layout_id list so the viewer can pick the right one.
   * Used by WarehouseMapDialog to find which layout contains a given location.
   */
  static async findLayoutsContainingLocation(
    supabase: SupabaseClient,
    orgId: string,
    locationId: string
  ): Promise<ServiceResult<{ layout_id: string; branch_id: string }[]>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .select("layout_id, branch_id")
      .eq("organization_id", orgId)
      .eq("location_id", locationId)
      .eq("shape_type", "location")
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return {
      success: true,
      data: data as { layout_id: string; branch_id: string }[],
    };
  }
}
