"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_PRODUCTS_MANAGE,
} from "@/lib/constants/permissions";
import {
  InventoryReceivingService,
  type ProductBranchSettings,
  type PutawayError,
  type PutawayResult,
  type ReceivingPending,
} from "@/server/services/inventory-receiving.service";

type Fail<E extends string = string> = { success: false; error: E };

async function activeScope() {
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? null;
  const branchId = context?.app.activeBranchId ?? null;
  const userId = context?.user.user?.id ?? null;
  if (!context || !orgId || !branchId || !userId) return null;
  return { context, orgId, branchId, userId };
}

/** Zone 5 -- what waits in the active branch's receiving zone. */
export async function listReceivingPendingAction(): Promise<
  { success: true; data: ReceivingPending } | Fail
> {
  try {
    const scope = await activeScope();
    if (!scope) return { success: false, error: "Unauthorized" };
    if (!checkPermission(scope.context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    const supabase = await createClient();
    return InventoryReceivingService.listPending(supabase, scope.orgId, scope.branchId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

const putawaySchema = z.object({
  variantId: z.string().uuid(),
  quantity: z.number().positive(),
  destinationLocationId: z.string().uuid(),
  repairOrderLineId: z.string().uuid().nullable(),
});

/**
 * Zone 5 -- put one item away out of the receiving zone (active branch).
 * Gated on `warehouse.inventory.operate`; org, branch and actor come from
 * server context. The RPC decides free / bulk / container handling.
 */
export async function putawayFromReceivingAction(
  rawInput: unknown
): Promise<{ success: true; data: PutawayResult } | Fail<PutawayError | "invalid_input">> {
  try {
    const scope = await activeScope();
    if (!scope) return { success: false, error: "unauthorized" };
    if (!checkPermission(scope.context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false, error: "unauthorized" };
    }
    const parsed = putawaySchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };

    const supabase = await createClient();
    const result = await InventoryReceivingService.putaway(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      variantId: parsed.data.variantId!,
      quantity: parsed.data.quantity!,
      destinationLocationId: parsed.data.destinationLocationId!,
      repairOrderLineId: parsed.data.repairOrderLineId ?? null,
    });
    if (!result.success) {
      return {
        success: false,
        error: (result as { success: false; error: string }).error as PutawayError,
      };
    }
    return result;
  } catch {
    return { success: false, error: "unexpected" };
  }
}

const productIdSchema = z.string().uuid();

/** Zone 5 -- a product's handling mode / fixed location in the active branch. */
export async function getProductHandlingAction(
  productId: string
): Promise<{ success: true; data: ProductBranchSettings } | Fail> {
  try {
    if (!productIdSchema.safeParse(productId).success) {
      return { success: false, error: "Invalid input" };
    }
    const scope = await activeScope();
    if (!scope) return { success: false, error: "Unauthorized" };
    if (!checkPermission(scope.context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    const supabase = await createClient();
    return InventoryReceivingService.getProductSettings(supabase, scope.branchId, productId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

const saveHandlingSchema = z.object({
  productId: z.string().uuid(),
  handlingMode: z.enum(["standard", "bulk"]),
  defaultLocationId: z.string().uuid().nullable(),
});

/** Zone 5 -- save a product's handling mode / fixed location (active branch). */
export async function saveProductHandlingAction(
  rawInput: unknown
): Promise<{ success: true; data: ProductBranchSettings } | Fail> {
  try {
    const scope = await activeScope();
    if (!scope) return { success: false, error: "Unauthorized" };
    if (!checkPermission(scope.context.user.permissionSnapshot, WAREHOUSE_PRODUCTS_MANAGE)) {
      return { success: false, error: "Unauthorized" };
    }
    const parsed = saveHandlingSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };

    const supabase = await createClient();
    return InventoryReceivingService.saveProductSettings(supabase, {
      organizationId: scope.orgId,
      branchId: scope.branchId,
      actorUserId: scope.userId,
      productId: parsed.data.productId!,
      handlingMode: parsed.data.handlingMode!,
      defaultLocationId: parsed.data.defaultLocationId ?? null,
    });
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
