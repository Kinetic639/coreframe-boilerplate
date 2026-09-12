"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { createClient } from "@/utils/supabase/server";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_ADJUST,
} from "@/lib/constants/permissions";
import {
  hasPermission,
  mapUnexpected,
  requireActiveBranch,
  requireWarehouseContext,
  userIdFrom,
} from "./inventory/action-context";
import {
  RepairOrderStorageService,
  type ServiceResult,
  type RepairOrderStorageSuggestion,
} from "@/server/services/repair-order-storage.service";

/**
 * Zone 5 Phases 4/5/6 -- server actions for RepairOrder-aware receiving and
 * putaway, plus the current-storage read model.
 *
 * IMPORTANT: these actions call `receive_repair_order_stock` /
 * `putaway_repair_order_stock` -- new SECURITY DEFINER RPCs written this
 * session but NOT applied to any live database (Supabase MCP was
 * unavailable throughout this implementation pass). Calling these actions
 * against a live environment before that migration is reviewed and applied
 * will fail with "function does not exist". This is a disclosed, expected
 * gap, not a bug in this file -- see the review bundle's migration summary.
 */

const receiveLineSchema = z.object({
  variant_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  quantity: z.number().positive(),
  source_line_id: z.string().uuid().nullable().optional(),
});

const receiveSchema = z.object({
  lines: z.array(receiveLineSchema).min(1, "At least one line is required"),
  operation_date: z.string().nullable().optional(),
  document_date: z.string().nullable().optional(),
  external_reference: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function receiveRepairOrderStockAction(
  rawInput: unknown
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return { success: false as const, error: auth.error };
    if (
      !hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE) &&
      !hasPermission(auth, WAREHOUSE_INVENTORY_ADJUST)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return { success: false as const, error: branch.error };

    const parsed = receiveSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const userId = userIdFrom(auth);
    if (!userId) return { success: false as const, error: "User identity unavailable" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("receive_repair_order_stock", {
      p_actor_user_id: userId,
      p_organization_id: orgId,
      p_branch_id: branch.branchId,
      p_lines: parsed.data.lines.map((l) => ({
        variant_id: l.variant_id,
        unit_id: l.unit_id,
        quantity: l.quantity,
        source_line_id: l.source_line_id ?? null,
      })),
      p_operation_date: parsed.data.operation_date ?? null,
      p_document_date: parsed.data.document_date ?? null,
      p_external_reference: parsed.data.external_reference ?? null,
      p_note: parsed.data.note ?? null,
      p_idempotency_key: crypto.randomUUID(),
    });

    if (error) return { success: false as const, error: error.message };
    revalidatePath("/dashboard/warehouse/inventory/movements");
    return { success: true as const, data };
  } catch (error) {
    return mapUnexpected(error);
  }
}

const putawayLineSchema = z.object({
  repair_order_line_id: z.string().uuid(),
  variant_id: z.string().uuid(),
  unit_id: z.string().uuid(),
  quantity: z.number().positive(),
});

const putawaySchema = z.object({
  lines: z.array(putawayLineSchema).min(1, "At least one line is required"),
  destination_location_id: z.string().uuid(),
});

export async function putawayRepairOrderStockAction(
  rawInput: unknown
): Promise<{ success: true; data: unknown } | { success: false; error: string }> {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return { success: false as const, error: auth.error };
    if (
      !hasPermission(auth, WAREHOUSE_INVENTORY_OPERATE) &&
      !hasPermission(auth, WAREHOUSE_INVENTORY_ADJUST)
    ) {
      return { success: false as const, error: "Unauthorized" };
    }
    const branch = requireActiveBranch(auth);
    if (!branch.success) return { success: false as const, error: branch.error };

    const parsed = putawaySchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const userId = userIdFrom(auth);
    if (!userId) return { success: false as const, error: "User identity unavailable" };

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("putaway_repair_order_stock", {
      p_actor_user_id: userId,
      p_organization_id: orgId,
      p_branch_id: branch.branchId,
      p_lines: parsed.data.lines,
      p_destination_location_id: parsed.data.destination_location_id,
      p_idempotency_key: crypto.randomUUID(),
    });

    if (error) return { success: false as const, error: error.message };
    revalidatePath("/dashboard/warehouse/inventory/movements");
    revalidatePath("/dashboard/warehouse/locations");
    return { success: true as const, data };
  } catch (error) {
    return mapUnexpected(error);
  }
}

const storageSuggestionsSchema = z.object({
  repair_order_id: z.string().uuid(),
});

export async function getRepairOrderStorageSuggestionsAction(
  rawInput: unknown
): Promise<
  { success: true; data: RepairOrderStorageSuggestion[] } | { success: false; error: string }
> {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return { success: false as const, error: auth.error };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return { success: false as const, error: branch.error };

    const parsed = storageSuggestionsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false as const, error: parsed.error.errors[0].message };

    const orgId = auth.context.app.activeOrgId;
    const supabase = await createClient();
    const result: ServiceResult<RepairOrderStorageSuggestion[]> =
      await RepairOrderStorageService.getStorageSuggestions(
        supabase,
        orgId,
        branch.branchId,
        parsed.data.repair_order_id
      );
    if (result.success === true) {
      return { success: true as const, data: result.data };
    } else {
      return { success: false as const, error: result.error };
    }
  } catch (error) {
    return mapUnexpected(error);
  }
}
