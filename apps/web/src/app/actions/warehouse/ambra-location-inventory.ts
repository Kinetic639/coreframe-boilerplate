"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { WAREHOUSE_INVENTORY_OPERATE } from "@/lib/constants/permissions";
import {
  hasPermission,
  mapUnexpected,
  requireActiveBranch,
  requireWarehouseContext,
  userIdFrom,
} from "./inventory/action-context";

const uuidSchema = z.string().uuid("Invalid id");

const createContainerSchema = z.object({
  code: z.string().trim().min(1, "Code is required").max(80),
  type: z.string().trim().max(40).optional().default("container"),
  current_location_id: uuidSchema,
});

const createPutawayRuleSchema = z
  .object({
    destination_location_id: uuidSchema,
    variant_id: uuidSchema.nullable().optional(),
    product_id: uuidSchema.nullable().optional(),
    product_category: z.string().trim().max(120).nullable().optional(),
    priority: z.number().int().min(0).max(10000).optional().default(100),
  })
  .refine(
    (value) => Boolean(value.variant_id || value.product_id || value.product_category),
    "Select a variant, product, or category"
  );

async function requireStockableLocation(
  locationId: string,
  orgId: string,
  branchId: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("warehouse_locations")
    .select("id, can_store_inventory")
    .eq("id", locationId)
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Location not found" };
  if (!data.can_store_inventory) {
    return { success: false, error: "Only stockable bins can hold inventory placement" };
  }
  return { success: true };
}

export async function createLocationContainerAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = createContainerSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const userId = userIdFrom(auth);
    if (!userId) return { success: false as const, error: "User identity unavailable" };

    const location = await requireStockableLocation(
      parsed.data.current_location_id,
      orgId,
      branch.branchId
    );
    if (!location.success) return location;

    const supabase = await createClient();
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_containers")
      .insert({
        organization_id: orgId,
        branch_id: branch.branchId,
        code: parsed.data.code,
        type: parsed.data.type,
        current_location_id: parsed.data.current_location_id,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error) return { success: false as const, error: error.message };
    revalidatePath("/dashboard/warehouse/ambra-locations");
    return { success: true as const, data };
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createLocationPutawayRuleAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = createPutawayRuleSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const userId = userIdFrom(auth);
    if (!userId) return { success: false as const, error: "User identity unavailable" };

    const location = await requireStockableLocation(
      parsed.data.destination_location_id,
      orgId,
      branch.branchId
    );
    if (!location.success) return location;

    const supabase = await createClient();
    const client = supabase as any;
    const { data, error } = await client
      .from("inventory_putaway_rules")
      .insert({
        organization_id: orgId,
        branch_id: branch.branchId,
        destination_location_id: parsed.data.destination_location_id,
        variant_id: parsed.data.variant_id ?? null,
        product_id: parsed.data.product_id ?? null,
        product_category: parsed.data.product_category || null,
        priority: parsed.data.priority,
        created_by: userId,
        updated_by: userId,
      })
      .select("id")
      .single();

    if (error) return { success: false as const, error: error.message };
    revalidatePath("/dashboard/warehouse/ambra-locations");
    return { success: true as const, data };
  } catch (error) {
    return mapUnexpected(error);
  }
}
