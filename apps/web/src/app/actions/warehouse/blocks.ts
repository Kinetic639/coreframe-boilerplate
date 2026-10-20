"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import {
  BLOCK_REASON_CODES,
  InventoryBlocksService,
  type ActiveBlockLine,
  type BlockEvent,
  type BlockResult,
} from "@/server/services/inventory-blocks.service";
import type { StockEngineError } from "@/server/services/inventory-reservations.service";

/**
 * Blocked stock (stage E5): block / unblock with a reason, move a blocked
 * part, return it to the supplier (122) or scrap it (551). Org, branch and
 * actor always come from the server context.
 */

type Fail<E extends string = string> = { success: false; error: E; message?: string };

async function activeScope(permission: string) {
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? null;
  const branchId = context?.app.activeBranchId ?? null;
  const userId = context?.user.user?.id ?? null;
  if (!context || !orgId || !branchId || !userId) return null;
  if (!checkPermission(context.user.permissionSnapshot, permission)) return null;
  return { orgId, branchId, userId };
}

const reason = z.string().trim().min(1).max(500);

const blockSchema = z
  .object({
    reasonCode: z.enum(BLOCK_REASON_CODES),
    description: z.string().trim().max(500).nullable().optional(),
    reference: z
      .object({
        type: z.string().trim().max(50).nullable().optional(),
        id: z.string().trim().max(100).nullable().optional(),
        number: z.string().trim().max(100).nullable().optional(),
      })
      .optional(),
    lines: z
      .array(
        z
          .object({
            quantity: z.number().positive(),
            variantId: z.string().uuid().nullable().optional(),
            locationId: z.string().uuid().nullable().optional(),
            reservationLineId: z.string().uuid().nullable().optional(),
          })
          .refine((l) => !!l.reservationLineId || (!!l.variantId && !!l.locationId))
      )
      .min(1)
      .max(200),
  })
  .refine((v) => v.reasonCode !== "other" || !!v.description?.trim());

export async function blockStockAction(
  rawInput: unknown
): Promise<{ success: true; data: BlockResult } | Fail<StockEngineError | "invalid_input">> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = blockSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryBlocksService.block(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryBlocksService.block>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

const blockLines = z
  .array(
    z.object({
      blockLineId: z.string().uuid(),
      quantity: z.number().positive().nullable().optional(),
    })
  )
  .min(1)
  .max(200);

export async function unblockStockAction(
  rawInput: unknown
): Promise<
  { success: true; data: { unblockedQuantity: number } } | Fail<StockEngineError | "invalid_input">
> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = z.object({ lines: blockLines, reason }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryBlocksService.unblock(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryBlocksService.unblock>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

const moveSchema = z.object({
  lines: blockLines,
  destinationLocationId: z.string().uuid(),
});

/** Blocked parts -> another location, on one MM; the blocks move with them. */
export async function moveBlockedStockAction(rawInput: unknown): Promise<
  | {
      success: true;
      data: { blockLineIds: string[]; movementId: string; documentNumber: string | null };
    }
  | Fail<StockEngineError | "invalid_input">
> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = moveSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryBlocksService.move(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryBlocksService.move>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

const issueSchema = z.object({
  kind: z.enum(["return_to_supplier", "scrap"]),
  lines: blockLines,
  reason,
  counterpartyName: z.string().trim().max(200).nullable().optional(),
});

export async function issueBlockedStockAction(rawInput: unknown): Promise<
  | {
      success: true;
      data: { movementId: string; documentNumber: string | null; movementTypeCode: string };
    }
  | Fail<StockEngineError | "invalid_input">
> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = issueSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryBlocksService.issue(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryBlocksService.issue>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

export async function listActiveBlocksAction(
  rawInput: unknown
): Promise<{ success: true; data: ActiveBlockLine[] } | Fail> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_READ);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = z
      .object({ variantId: z.string().uuid().optional(), locationId: z.string().uuid().optional() })
      .safeParse(rawInput ?? {});
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    return InventoryBlocksService.listActive(supabase, scope.orgId, scope.branchId, parsed.data);
  } catch {
    return { success: false, error: "failed" };
  }
}

export async function listBlockHistoryAction(
  rawInput: unknown
): Promise<{ success: true; data: BlockEvent[] } | Fail> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_READ);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = z.object({ blockId: z.string().uuid() }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    return InventoryBlocksService.listHistory(
      supabase,
      scope.orgId,
      scope.branchId,
      parsed.data.blockId
    );
  } catch {
    return { success: false, error: "failed" };
  }
}
