"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_LAYOUTS_PUBLISH } from "@/lib/constants/permissions";
import type { WarehouseLocation, WarehouseLocationGroup } from "@/lib/warehouse/location-tree";
import type {
  WarehouseLayout,
  WarehouseLayoutShape,
  WarehouseLayoutWithShapes,
} from "@/lib/warehouse/layouts";

type SR<T> = { success: true; data: T } | { success: false; error: string };

const branchIdSchema = z.string().uuid();
const setPublicMapsSchema = z.object({
  branchId: z.string().uuid(),
  enabled: z.boolean(),
});

export interface PublicWarehouseBranchBundle {
  branch: {
    id: string;
    name: string;
    slug: string | null;
  };
  layouts: WarehouseLayoutWithShapes[];
  locations: WarehouseLocation[];
  locationGroups: WarehouseLocationGroup[];
}

const layoutColumns =
  "id, organization_id, branch_id, root_location_id, name, description, status, canvas_width_m, canvas_height_m, published_at, created_by, updated_by, created_at, updated_at, deleted_at" as const;

const shapeColumns =
  "id, layout_id, organization_id, branch_id, shape_type, projection, anchor_location_id, location_id, label, x, y, width, height, rotation, style, z_index, sort_order, created_by, created_at, updated_at, deleted_at" as const;

const locationColumns =
  "id, organization_id, branch_id, name, code, description, icon_name, color, parent_id, group_id, inherit_group_color, inherit_parent_color, physical_width_m, physical_depth_m, physical_height_m, physical_elevation_start_m, map_role, storage_mode, allow_top_storage, level, sort_order, qr_code, created_by, updated_by, created_at, updated_at, deleted_at" as const;

const groupColumns =
  "id, organization_id, branch_id, parent_location_id, name, description, color, sort_order, created_by, created_at, updated_at, deleted_at" as const;

export async function getPublicWarehouseBranchBundleAction(
  rawBranchId: string
): Promise<SR<PublicWarehouseBranchBundle | null>> {
  const parsed = branchIdSchema.safeParse(rawBranchId);
  if (!parsed.success) return { success: false, error: "Invalid branch id" };

  const supabase = await createClient();

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, name, slug, public_warehouse_maps_enabled")
    .eq("id", parsed.data)
    .eq("public_warehouse_maps_enabled", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (branchError) return { success: false, error: branchError.message };
  if (!branch) return { success: true, data: null };

  const [
    { data: layouts, error: layoutsError },
    { data: locations, error: locationsError },
    { data: groups, error: groupsError },
    { data: shapes, error: shapesError },
  ] = await Promise.all([
    supabase
      .from("warehouse_layouts")
      .select(layoutColumns)
      .eq("branch_id", parsed.data)
      .eq("status", "published")
      .is("deleted_at", null)
      .order("published_at", { ascending: false }),
    supabase
      .from("warehouse_locations")
      .select(locationColumns)
      .eq("branch_id", parsed.data)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("warehouse_location_groups")
      .select(groupColumns)
      .eq("branch_id", parsed.data)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    supabase
      .from("warehouse_layout_shapes")
      .select(shapeColumns)
      .eq("branch_id", parsed.data)
      .is("deleted_at", null)
      .order("z_index", { ascending: true })
      .order("sort_order", { ascending: true }),
  ]);

  if (layoutsError) return { success: false, error: layoutsError.message };
  if (locationsError) return { success: false, error: locationsError.message };
  if (groupsError) return { success: false, error: groupsError.message };
  if (shapesError) return { success: false, error: shapesError.message };

  const shapesByLayoutId = new Map<string, WarehouseLayoutShape[]>();
  for (const shape of (shapes ?? []) as WarehouseLayoutShape[]) {
    const siblings = shapesByLayoutId.get(shape.layout_id) ?? [];
    siblings.push(shape);
    shapesByLayoutId.set(shape.layout_id, siblings);
  }

  const layoutsWithShapes = ((layouts ?? []) as WarehouseLayout[]).map((layout) => ({
    ...layout,
    shapes: shapesByLayoutId.get(layout.id) ?? [],
  }));

  return {
    success: true,
    data: {
      branch: {
        id: branch.id,
        name: branch.name,
        slug: branch.slug ?? null,
      },
      layouts: layoutsWithShapes,
      locations: (locations ?? []) as WarehouseLocation[],
      locationGroups: (groups ?? []) as WarehouseLocationGroup[],
    },
  };
}

export async function setBranchPublicWarehouseMapsAction(
  rawInput: unknown
): Promise<SR<{ enabled: boolean }>> {
  const parsed = setPublicMapsSchema.safeParse(rawInput);
  if (!parsed.success)
    return { success: false, error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId || !context.app.activeBranchId) {
    return { success: false, error: "No active organization or branch" };
  }

  if (!checkPermission(context.user.permissionSnapshot, WAREHOUSE_LAYOUTS_PUBLISH)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_branch_public_warehouse_maps", {
    p_branch_id: parsed.data.branchId,
    p_enabled: parsed.data.enabled,
  });

  if (error) return { success: false, error: error.message };
  return { success: true, data: { enabled: parsed.data.enabled } };
}
