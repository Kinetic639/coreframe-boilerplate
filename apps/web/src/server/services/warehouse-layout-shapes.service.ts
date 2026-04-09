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
  "id, layout_id, organization_id, branch_id, shape_type, location_id, label, x, y, width, height, rotation, style, z_index, sort_order, created_by, created_at, updated_at, deleted_at" as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLayoutShapesService {
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

  /**
   * Batch save — the primary editor save operation.
   *
   * Treats the input array as the canonical active shape state for the layout:
   * - Shapes in DB but NOT in the input list are soft-deleted
   * - Shapes in the input list are upserted (insert new, update existing)
   *
   * Each shape in the input must carry a client-generated UUID as `id`.
   * org_id and branch_id are copied from the parent layout — not accepted in input.
   *
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
    // 1. Fetch all currently active shape IDs for this layout
    const { data: existing, error: fetchError } = await supabase
      .from("warehouse_layout_shapes")
      .select("id")
      .eq("layout_id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (fetchError) return { success: false, error: fetchError.message };

    const inputIds = new Set(shapes.map((s) => s.id));
    const idsToDelete = (existing ?? [])
      .map((r) => r.id as string)
      .filter((id) => !inputIds.has(id));

    // 2. Soft-delete shapes removed from the canvas
    if (idsToDelete.length > 0) {
      const { error: deleteError } = await supabase
        .from("warehouse_layout_shapes")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", idsToDelete)
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (deleteError) return { success: false, error: deleteError.message };
    }

    // 3. Upsert active shapes. Each row carries the full current state from the editor.
    if (shapes.length > 0) {
      const rows = shapes.map((s, idx) => ({
        id: s.id,
        layout_id: layoutId,
        organization_id: orgId,
        branch_id: branchId,
        shape_type: s.shape_type,
        location_id: s.location_id ?? null,
        label: s.label ?? null,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
        rotation: s.rotation,
        style: s.style ?? null,
        z_index: s.z_index ?? 0,
        sort_order: s.sort_order ?? idx,
        created_by: userId,
        // deleted_at must be NULL on upsert to restore any previously soft-deleted shape
        // that was re-added to the canvas with the same ID.
        deleted_at: null,
      }));

      const { error: upsertError } = await supabase.from("warehouse_layout_shapes").upsert(rows, {
        onConflict: "id",
        ignoreDuplicates: false,
      });

      if (upsertError) return { success: false, error: upsertError.message };
    }

    // 4. Return the fresh active shape list
    return WarehouseLayoutShapesService.listByLayout(supabase, orgId, layoutId);
  }

  /**
   * Upsert a single shape (for incremental saves, e.g. after a single drag-end).
   * org_id and branch_id must be supplied by the caller (copied from the layout).
   */
  static async upsertOne(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    layoutId: string,
    userId: string,
    shape: ShapeUpsertInput
  ): Promise<ServiceResult<WarehouseLayoutShape>> {
    const { data, error } = await supabase
      .from("warehouse_layout_shapes")
      .upsert(
        {
          id: shape.id,
          layout_id: layoutId,
          organization_id: orgId,
          branch_id: branchId,
          shape_type: shape.shape_type,
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
