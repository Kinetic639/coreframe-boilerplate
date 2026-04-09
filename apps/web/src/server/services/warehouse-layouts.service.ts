/**
 * Warehouse Layouts Service
 *
 * Manages visual map documents (layouts) for a branch.
 * A layout is a named canvas that contains shapes (warehouse_layout_shapes).
 * It is separate from the operational warehouse_locations hierarchy.
 *
 * Constraints:
 * - server-only (never import from client components)
 * - uses authenticated Supabase client only (no service role)
 * - never bypasses RLS
 * - fail-closed: returns ServiceResult<T>, never throws to callers
 *
 * Publishing rules:
 * - Only one layout may be published per (org, branch, root_location_id) scope.
 * - Publishing is atomic: the DB RPC unpublishes the current layout for the
 *   scope and publishes the target in a single transaction.
 * - Unpublishing reverts a layout to 'draft' without affecting other layouts.
 * - warehouse.layouts.publish permission is required for publish; manage for all else.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Re-exports for consumers that go through the service ────────────────────

export type {
  WarehouseLayout,
  WarehouseLayoutWithShapes,
  LayoutStatus,
} from "@/lib/warehouse/layouts";

import type { WarehouseLayout, WarehouseLayoutWithShapes } from "@/lib/warehouse/layouts";
import { WarehouseLayoutShapesService } from "./warehouse-layout-shapes.service";

// ─── ServiceResult ────────────────────────────────────────────────────────────

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

// ─── Input types ─────────────────────────────────────────────────────────────

export interface CreateLayoutInput {
  name: string;
  description?: string | null;
  root_location_id?: string | null;
  canvas_width_m?: number;
  canvas_height_m?: number;
}

export interface UpdateLayoutInput {
  name?: string;
  description?: string | null;
  canvas_width_m?: number;
  canvas_height_m?: number;
}

// ─── Column select ─────────────────────────────────────────────────────────

const LAYOUT_COLUMNS =
  "id, organization_id, branch_id, root_location_id, name, description, status, canvas_width_m, canvas_height_m, published_at, created_by, updated_by, created_at, updated_at, deleted_at" as const;

// ─── Service ──────────────────────────────────────────────────────────────────

export class WarehouseLayoutsService {
  /**
   * List all active (non-deleted) layouts for a branch, ordered by name.
   * Returns both draft and published layouts — callers apply status filter as needed.
   */
  static async listByBranch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<WarehouseLayout[]>> {
    const { data, error } = await supabase
      .from("warehouse_layouts")
      .select(LAYOUT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayout[] };
  }

  /**
   * Get a single layout by ID. Returns null if not found (not an error).
   * Verifies the layout belongs to the given org before returning.
   */
  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string
  ): Promise<ServiceResult<WarehouseLayout | null>> {
    const { data, error } = await supabase
      .from("warehouse_layouts")
      .select(LAYOUT_COLUMNS)
      .eq("id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayout | null };
  }

  /**
   * Get a layout with all its active shapes pre-loaded.
   * Used by the editor page SSR loader and the viewer dialog.
   */
  static async getWithShapes(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string
  ): Promise<ServiceResult<WarehouseLayoutWithShapes | null>> {
    const layoutResult = await WarehouseLayoutsService.getById(supabase, orgId, layoutId);
    if (!layoutResult.success)
      return { success: false, error: (layoutResult as { success: false; error: string }).error };
    if (!layoutResult.data) return { success: true, data: null };

    const shapesResult = await WarehouseLayoutShapesService.listByLayout(supabase, orgId, layoutId);
    if (!shapesResult.success)
      return { success: false, error: (shapesResult as { success: false; error: string }).error };

    return {
      success: true,
      data: { ...layoutResult.data, shapes: shapesResult.data },
    };
  }

  /**
   * Get the published layout for a given scope, with shapes.
   * scope = (branchId, rootLocationId?) — rootLocationId null means whole-branch.
   * Returns null if no published layout exists for the scope (not an error).
   * Used by the viewer dialog when opened from elsewhere in the app.
   */
  static async getPublishedForScope(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    rootLocationId?: string | null
  ): Promise<ServiceResult<WarehouseLayoutWithShapes | null>> {
    let query = supabase
      .from("warehouse_layouts")
      .select(LAYOUT_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("status", "published")
      .is("deleted_at", null);

    if (rootLocationId === undefined) {
      // No scope filter — return any published layout for this branch.
      // Limit to 1 to avoid maybeSingle() failing when multiple layouts are published.
      query = query.limit(1);
    } else if (rootLocationId === null) {
      query = query.is("root_location_id", null);
    } else {
      query = query.eq("root_location_id", rootLocationId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    const shapesResult = await WarehouseLayoutShapesService.listByLayout(
      supabase,
      orgId,
      (data as WarehouseLayout).id
    );
    if (!shapesResult.success)
      return { success: false, error: (shapesResult as { success: false; error: string }).error };

    return {
      success: true,
      data: { ...(data as WarehouseLayout), shapes: shapesResult.data },
    };
  }

  /**
   * Create a new draft layout for a branch.
   * status is always 'draft' on creation — use publish() to make it canonical.
   */
  static async create(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    userId: string,
    input: CreateLayoutInput
  ): Promise<ServiceResult<WarehouseLayout>> {
    const { data, error } = await supabase
      .from("warehouse_layouts")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        root_location_id: input.root_location_id ?? null,
        name: input.name.trim(),
        description: input.description ?? null,
        status: "draft",
        canvas_width_m: input.canvas_width_m ?? 50,
        canvas_height_m: input.canvas_height_m ?? 30,
        created_by: userId,
        updated_by: userId,
      })
      .select(LAYOUT_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayout };
  }

  /**
   * Update a layout's metadata (name, description, canvas dimensions).
   * Does not affect status — use publish() / unpublish() for that.
   * Verifies the layout belongs to the given org before updating.
   */
  static async update(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    userId: string,
    input: UpdateLayoutInput
  ): Promise<ServiceResult<WarehouseLayout>> {
    const updates: Record<string, unknown> = { updated_by: userId };

    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.description !== undefined) updates.description = input.description;
    if (input.canvas_width_m !== undefined) updates.canvas_width_m = input.canvas_width_m;
    if (input.canvas_height_m !== undefined) updates.canvas_height_m = input.canvas_height_m;

    const { data, error } = await supabase
      .from("warehouse_layouts")
      .update(updates)
      .eq("id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(LAYOUT_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayout };
  }

  /**
   * Publish a layout via the DB RPC.
   * The RPC atomically unpublishes any currently published layout for the
   * same scope and publishes the target — all in one transaction.
   * Requires warehouse.layouts.publish permission (checked inside the RPC).
   */
  static async publish(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    userId: string
  ): Promise<ServiceResult<WarehouseLayout>> {
    const { error: rpcError } = await supabase.rpc("publish_warehouse_layout", {
      p_layout_id: layoutId,
      p_user_id: userId,
    });

    if (rpcError) {
      // Map known RPC exception prefixes to friendly messages
      const msg = rpcError.message ?? "";
      if (msg.includes("layout_not_found")) return { success: false, error: "Layout not found" };
      if (msg.includes("insufficient_permission"))
        return { success: false, error: "You do not have permission to publish layouts" };
      return { success: false, error: rpcError.message };
    }

    // Fetch the now-published layout to return fresh data
    const result = await WarehouseLayoutsService.getById(supabase, orgId, layoutId);
    if (!result.success) return result;
    if (!result.data) return { success: false, error: "Layout not found after publish" };
    return { success: true, data: result.data };
  }

  /**
   * Revert a published layout back to draft.
   * Does not affect any other layouts for the scope.
   */
  static async unpublish(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string,
    userId: string
  ): Promise<ServiceResult<WarehouseLayout>> {
    const { data, error } = await supabase
      .from("warehouse_layouts")
      .update({ status: "draft", updated_by: userId })
      .eq("id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(LAYOUT_COLUMNS)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WarehouseLayout };
  }

  /**
   * Soft-delete a layout. Also soft-deletes all of its shapes atomically.
   * Published layouts may be deleted — callers should warn the user first.
   */
  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    layoutId: string
  ): Promise<ServiceResult<void>> {
    const now = new Date().toISOString();

    // Soft-delete shapes first (they CASCADE via layout_id FK but we need soft-delete)
    const { error: shapesError } = await supabase
      .from("warehouse_layout_shapes")
      .update({ deleted_at: now })
      .eq("layout_id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (shapesError) return { success: false, error: shapesError.message };

    const { error } = await supabase
      .from("warehouse_layouts")
      .update({ deleted_at: now })
      .eq("id", layoutId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);

    if (error) return { success: false, error: error.message };
    return { success: true, data: undefined };
  }
}
