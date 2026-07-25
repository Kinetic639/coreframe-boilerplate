"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { WAREHOUSE_INVENTORY_OPERATE } from "@/lib/constants/permissions";
import { InventoryMovementsService } from "@/server/services/inventory-movements.service";
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
    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const, data };
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function deletePutawayRuleAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = uuidSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: "Invalid rule id" };

    const orgId = auth.context.app.activeOrgId;
    const supabase = await createClient();
    const client = supabase as any;
    const { error } = await client
      .from("inventory_putaway_rules")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId);

    if (error) return { success: false as const, error: error.message };
    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const };
  } catch (error) {
    return mapUnexpected(error);
  }
}

const addItemsSchema = z.object({
  container_id: uuidSchema,
  lines: z
    .array(
      z.object({
        variant_id: uuidSchema,
        unit_id: uuidSchema,
        quantity: z.number().positive("Quantity must be positive"),
      })
    )
    .min(1, "At least one item required"),
});

export async function addItemsToContainerAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = addItemsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const supabase = await createClient();
    const client = supabase as any;

    const { data: container, error: containerError } = await client
      .from("inventory_containers")
      .select("id, status, current_location_id")
      .eq("id", parsed.data.container_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .is("deleted_at", null)
      .maybeSingle();

    if (containerError) return { success: false as const, error: containerError.message };
    if (!container) return { success: false as const, error: "Container not found" };
    if (container.status === "archived") {
      return { success: false as const, error: "Cannot add items to an archived container" };
    }

    const locationId = container.current_location_id as string;

    for (const line of parsed.data.lines) {
      const { data: balance, error: balanceError } = await supabase
        .from("inventory_balances")
        .select("id, available_quantity, allocated_quantity")
        .eq("organization_id", orgId)
        .eq("branch_id", branch.branchId)
        .eq("location_id", locationId)
        .eq("variant_id", line.variant_id)
        .maybeSingle();

      if (balanceError) return { success: false as const, error: balanceError.message };
      if (!balance) {
        return { success: false as const, error: `No stock found for this variant in this bin` };
      }

      const available = Number(balance.available_quantity ?? 0);
      if (available < line.quantity) {
        return {
          success: false as const,
          error: `Not enough available stock (available: ${available}, requested: ${line.quantity})`,
        };
      }

      const { error: updateError } = await supabase
        .from("inventory_balances")
        .update({
          allocated_quantity: Number(balance.allocated_quantity ?? 0) + line.quantity,
        })
        .eq("id", balance.id);

      if (updateError) return { success: false as const, error: updateError.message };
    }

    const rows = parsed.data.lines.map((line) => ({
      organization_id: orgId,
      branch_id: branch.branchId,
      container_id: parsed.data.container_id,
      variant_id: line.variant_id,
      unit_id: line.unit_id,
      quantity: line.quantity,
    }));

    const { error } = await client.from("inventory_container_lines").insert(rows);
    if (error) return { success: false as const, error: error.message };

    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const };
  } catch (error) {
    return mapUnexpected(error);
  }
}

const removeItemSchema = z.object({
  container_id: uuidSchema,
  line_id: uuidSchema,
});

export async function removeItemFromContainerAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = removeItemSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const userId = userIdFrom(auth);
    if (!userId) return { success: false as const, error: "User identity unavailable" };
    const supabase = await createClient();
    const client = supabase as any;

    const { data: line, error: lineError } = await client
      .from("inventory_container_lines")
      .select("id, variant_id, unit_id, quantity, container_id")
      .eq("id", parsed.data.line_id)
      .eq("container_id", parsed.data.container_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .is("deleted_at", null)
      .maybeSingle();

    if (lineError) return { success: false as const, error: lineError.message };
    if (!line) return { success: false as const, error: "Container line not found" };

    const { data: container, error: containerError } = await client
      .from("inventory_containers")
      .select("id, current_location_id")
      .eq("id", parsed.data.container_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .is("deleted_at", null)
      .maybeSingle();

    if (containerError) return { success: false as const, error: containerError.message };
    if (!container) return { success: false as const, error: "Container not found" };

    const locationId = container.current_location_id as string;
    const qty = Number(line.quantity);

    // v1: no issue movement type available yet — just release allocated qty
    const { data: balance } = await supabase
      .from("inventory_balances")
      .select("id, allocated_quantity")
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .eq("location_id", locationId)
      .eq("variant_id", line.variant_id)
      .maybeSingle();

    if (balance) {
      const newAllocated = Math.max(0, Number(balance.allocated_quantity ?? 0) - qty);
      await supabase
        .from("inventory_balances")
        .update({ allocated_quantity: newAllocated })
        .eq("id", balance.id);
    }

    await client
      .from("inventory_container_lines")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", parsed.data.line_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId);

    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const };
  } catch (error) {
    return mapUnexpected(error);
  }
}

const relocateContainerSchema = z.object({
  container_id: uuidSchema,
  to_location_id: uuidSchema,
});

export async function relocateContainerAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = relocateContainerSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const userId = userIdFrom(auth);
    if (!userId) return { success: false as const, error: "User identity unavailable" };
    const supabase = await createClient();
    const client = supabase as any;

    const { data: container, error: containerError } = await client
      .from("inventory_containers")
      .select("id, current_location_id, status")
      .eq("id", parsed.data.container_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .is("deleted_at", null)
      .maybeSingle();

    if (containerError) return { success: false as const, error: containerError.message };
    if (!container) return { success: false as const, error: "Container not found" };
    if (container.status === "archived") {
      return { success: false as const, error: "Cannot move an archived container" };
    }

    const sourceLocationId = container.current_location_id as string;
    const destLocationId = parsed.data.to_location_id;
    if (sourceLocationId === destLocationId) {
      return { success: false as const, error: "Container is already at this location" };
    }

    const destLocation = await requireStockableLocation(destLocationId, orgId, branch.branchId);
    if (!destLocation.success) return destLocation;

    const { data: containerLines, error: linesError } = await client
      .from("inventory_container_lines")
      .select("id, variant_id, unit_id, quantity")
      .eq("container_id", parsed.data.container_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .is("deleted_at", null);

    if (linesError) return { success: false as const, error: linesError.message };

    const lines = (containerLines ?? []) as Array<{
      id: string;
      variant_id: string;
      unit_id: string;
      quantity: number | string;
    }>;

    if (lines.length > 0) {
      const movementLines = lines.map((line) => ({
        variant_id: line.variant_id,
        source_location_id: sourceLocationId,
        destination_location_id: destLocationId,
        unit_id: line.unit_id,
        quantity: Number(line.quantity),
      }));

      const draft = await InventoryMovementsService.createDraft(
        supabase,
        orgId,
        branch.branchId,
        {
          movement_type_code: "801",
          lines: movementLines,
          idempotency_key: crypto.randomUUID(),
        },
        userId
      );
      if (!draft.success)
        return {
          success: false as const,
          error: (draft as { success: false; error: string }).error,
        };

      const posted = await InventoryMovementsService.finalizePosting(
        supabase,
        draft.data.movement_id,
        userId
      );
      if (!posted.success)
        return {
          success: false as const,
          error: (posted as { success: false; error: string }).error,
        };

      for (const line of lines) {
        const qty = Number(line.quantity);

        const { data: srcBalance } = await supabase
          .from("inventory_balances")
          .select("id, allocated_quantity")
          .eq("organization_id", orgId)
          .eq("branch_id", branch.branchId)
          .eq("location_id", sourceLocationId)
          .eq("variant_id", line.variant_id)
          .maybeSingle();

        if (srcBalance) {
          await supabase
            .from("inventory_balances")
            .update({
              allocated_quantity: Math.max(0, Number(srcBalance.allocated_quantity ?? 0) - qty),
            })
            .eq("id", srcBalance.id);
        }

        const { data: destBalance } = await supabase
          .from("inventory_balances")
          .select("id, allocated_quantity")
          .eq("organization_id", orgId)
          .eq("branch_id", branch.branchId)
          .eq("location_id", destLocationId)
          .eq("variant_id", line.variant_id)
          .maybeSingle();

        if (destBalance) {
          await supabase
            .from("inventory_balances")
            .update({
              allocated_quantity: Number(destBalance.allocated_quantity ?? 0) + qty,
            })
            .eq("id", destBalance.id);
        }
      }
    }

    const { error: updateError } = await client
      .from("inventory_containers")
      .update({
        current_location_id: destLocationId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.container_id)
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId);

    if (updateError) return { success: false as const, error: updateError.message };

    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const };
  } catch (error) {
    return mapUnexpected(error);
  }
}

const findByReferenceSchema = z.object({
  reference_type: z.string().trim().min(1),
  reference_id: z.string().trim().min(1),
});

export async function findContainersByReferenceAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;

    const parsed = findByReferenceSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const supabase = await createClient();
    const client = supabase as any;

    const { data, error } = await client
      .from("inventory_containers")
      .select(
        "id, code, type, status, current_location_id, reference_type, reference_id, created_at, updated_at"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branch.branchId)
      .eq("reference_type", parsed.data.reference_type)
      .eq("reference_id", parsed.data.reference_id)
      .is("deleted_at", null)
      .neq("status", "archived")
      .order("updated_at", { ascending: false });

    if (error) return { success: false as const, error: error.message };

    const containers = (data ?? []) as Array<{
      id: string;
      code: string;
      type: string;
      status: string;
      current_location_id: string;
      reference_type: string | null;
      reference_id: string | null;
      created_at: string;
      updated_at: string;
    }>;

    if (containers.length === 0) return { success: true as const, data: [] };

    const locationIds = [...new Set(containers.map((c) => c.current_location_id))];
    const { data: locationsData } = await supabase
      .from("warehouse_locations")
      .select("id, name, code")
      .eq("organization_id", orgId)
      .in("id", locationIds);

    const locationsById = new Map(
      ((locationsData ?? []) as Array<{ id: string; name: string; code: string }>).map((l) => [
        l.id,
        l,
      ])
    );

    return {
      success: true as const,
      data: containers.map((c) => {
        const loc = locationsById.get(c.current_location_id);
        return {
          id: c.id,
          code: c.code,
          type: c.type,
          status: c.status,
          currentLocationId: c.current_location_id,
          currentLocationName: loc ? `${loc.code} - ${loc.name}` : null,
          referenceType: c.reference_type,
          referenceId: c.reference_id,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        };
      }),
    };
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
    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const, data };
  } catch (error) {
    return mapUnexpected(error);
  }
}
