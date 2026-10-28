"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
  WAREHOUSE_SETTINGS_MANAGE,
} from "@/lib/constants/permissions";
import {
  InternalOrderOperationsService,
  type InternalOrderError,
  type StockElsewhere,
} from "@/server/services/internal-orders.service";
import { InventoryReservationsService } from "@/server/services/inventory-reservations.service";

/**
 * Internal orders (ZW, docs/INTERNAL_ORDERS_PLAN.md): create from a repair
 * order or for another branch, reserve from stock, cancel a line, set the
 * AutoStacja number, ship to the branch, reserve at another branch, accept /
 * send branch transfers. Org, branch and actor always come from the server
 * context; every rule lives in the RPCs.
 */

type Fail = { success: false; error: InternalOrderError | "invalid_input" };

async function activeScope(permission: string) {
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? null;
  const branchId = context?.app.activeBranchId ?? null;
  const userId = context?.user.user?.id ?? null;
  if (!context || !orgId || !branchId || !userId) return null;
  if (!checkPermission(context.user.permissionSnapshot, permission)) return null;
  return { orgId, branchId, userId };
}

const uuid = z.string().uuid();
const qty = z.number().positive().max(1_000_000);
const text = (max: number) => z.string().trim().max(max).nullable().optional();
const reserveLines = z
  .array(z.object({ internalOrderLineId: uuid, locationId: uuid, quantity: qty }))
  .min(1)
  .max(200);

const createSchema = z.object({
  repairOrderId: uuid.nullable().optional(),
  externalNumber: text(60),
  clientName: text(200),
  destinationCode: text(40),
  notes: text(1000),
  warehouseCode: text(20),
  lines: z
    .array(
      z.object({
        repairOrderLineId: uuid.nullable().optional(),
        variantId: uuid.nullable().optional(),
        productCode: text(120),
        productName: text(300),
        quantity: qty,
        reserve: z
          .array(z.object({ locationId: uuid, quantity: qty }))
          .max(20)
          .optional(),
      })
    )
    .min(1)
    .max(200),
});

export async function createInternalOrderAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = createSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const input = parsed.data as z.infer<typeof createSchema>;
    const supabase = await createClient();
    return InternalOrderOperationsService.create(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      repairOrderId: input.repairOrderId ?? null,
      externalNumber: input.externalNumber || null,
      clientName: input.clientName || null,
      destinationCode: input.destinationCode || null,
      notes: input.notes || null,
      warehouseCode: input.warehouseCode || null,
      lines: input.lines.map((l) => ({
        repairOrderLineId: l.repairOrderLineId ?? null,
        variantId: l.variantId ?? null,
        productCode: l.productCode || null,
        productName: l.productName || null,
        quantity: l.quantity!,
        reserve: (l.reserve ?? []).map((r) => ({
          locationId: r.locationId!,
          quantity: r.quantity!,
        })),
      })),
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function reserveInternalOrderFromStockAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z.object({ internalOrderId: uuid, lines: reserveLines }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.reserveFromStock(supabase, {
      actorUserId: scope.userId,
      internalOrderId: parsed.data.internalOrderId!,
      lines: parsed.data.lines!.map((l) => ({
        internalOrderLineId: l.internalOrderLineId!,
        locationId: l.locationId!,
        quantity: l.quantity!,
      })),
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function cancelInternalOrderLineAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({ internalOrderLineId: uuid, reason: z.string().trim().min(1).max(500) })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "reason_required" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.cancelLine(supabase, {
      actorUserId: scope.userId,
      internalOrderLineId: parsed.data.internalOrderLineId!,
      reason: parsed.data.reason!,
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function setInternalOrderExternalNumberAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({ internalOrderId: uuid, externalNumber: z.string().trim().min(1).max(60) })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.setExternalNumber(supabase, {
      actorUserId: scope.userId,
      internalOrderId: parsed.data.internalOrderId!,
      externalNumber: parsed.data.externalNumber!,
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function shipInternalOrderAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({
        internalOrderId: uuid,
        destinationBranchId: uuid.nullable().optional(),
        send: z.boolean().optional(),
      })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.ship(supabase, {
      actorUserId: scope.userId,
      internalOrderId: parsed.data.internalOrderId!,
      destinationBranchId: parsed.data.destinationBranchId ?? null,
      send: parsed.data.send !== false,
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function requestInternalOrderFromBranchAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({ internalOrderId: uuid, sourceBranchId: uuid, lines: reserveLines })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.requestFromBranch(supabase, {
      actorUserId: scope.userId,
      internalOrderId: parsed.data.internalOrderId!,
      sourceBranchId: parsed.data.sourceBranchId!,
      lines: parsed.data.lines!.map((l) => ({
        internalOrderLineId: l.internalOrderLineId!,
        locationId: l.locationId!,
        quantity: l.quantity!,
      })),
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function acceptBranchTransferIntoReceivingAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z.object({ transferId: uuid }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.acceptTransfer(supabase, {
      actorUserId: scope.userId,
      transferId: parsed.data.transferId!,
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export async function sendBranchTransferAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z.object({ transferId: uuid }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.sendTransfer(supabase, {
      actorUserId: scope.userId,
      transferId: parsed.data.transferId!,
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

export type InternalOrderStockOptions = {
  here: Array<{
    variantId: string;
    locationId: string;
    locationCode: string | null;
    locationName: string | null;
    available: number;
  }>;
  elsewhere: StockElsewhere[];
};

/** Where the parts are free: in this branch and at the other branches. */
export async function listInternalOrderStockAction(
  rawInput: unknown
): Promise<{ success: true; data: InternalOrderStockOptions } | Fail> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_READ);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = z.object({ variantIds: z.array(uuid).max(200) }).safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const variantIds = parsed.data.variantIds as string[];
    const supabase = await createClient();
    const [here, elsewhere] = await Promise.all([
      InventoryReservationsService.listAvailableStock(
        supabase,
        scope.orgId,
        scope.branchId,
        variantIds
      ),
      InternalOrderOperationsService.stockElsewhere(
        supabase,
        scope.orgId,
        scope.branchId,
        variantIds
      ),
    ]);
    return {
      success: true,
      data: {
        here: here.success ? (here as { data: InternalOrderStockOptions["here"] }).data : [],
        elsewhere: elsewhere.success ? (elsewhere as { data: StockElsewhere[] }).data : [],
      },
    };
  } catch {
    return { success: false, error: "unexpected" };
  }
}

export async function setBranchExternalCodesAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_SETTINGS_MANAGE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({ branchId: uuid, codes: z.array(z.string().trim().max(40)).max(20) })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.setBranchCodes(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: parsed.data.branchId!,
      codes: (parsed.data.codes ?? []).filter((c): c is string => !!c),
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

/** The sender withdraws an MMJ- (draft or in transit) before it is accepted. */
export async function withdrawBranchTransferAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({ transferId: uuid, reason: z.string().trim().max(500).nullable().optional() })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    const supabase = await createClient();
    return InternalOrderOperationsService.withdrawTransfer(supabase, {
      actorUserId: scope.userId,
      transferId: parsed.data.transferId!,
      reason: parsed.data.reason || null,
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}

/** A new MMJ- from the movement editor: "Tak — wyślij w drogę" (send) or "Nie — wstrzymaj". */
export async function createUnitTransferAction(rawInput: unknown) {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" } satisfies Fail;
    const parsed = z
      .object({
        destinationBranchId: uuid,
        notes: z.string().trim().max(1000).nullable().optional(),
        send: z.boolean(),
        lines: z
          .array(z.object({ variantId: uuid, sourceLocationId: uuid, unitId: uuid, quantity: qty }))
          .min(1)
          .max(500),
      })
      .safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" } satisfies Fail;
    if (parsed.data.destinationBranchId === scope.branchId) {
      return { success: false, error: "no_destination" } satisfies Fail;
    }
    const supabase = await createClient();
    return InternalOrderOperationsService.createTransfer(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      sourceBranchId: scope.branchId,
      destinationBranchId: parsed.data.destinationBranchId!,
      notes: parsed.data.notes || null,
      send: parsed.data.send!,
      lines: parsed.data.lines!.map((l) => ({
        variantId: l.variantId!,
        sourceLocationId: l.sourceLocationId!,
        unitId: l.unitId!,
        quantity: l.quantity!,
      })),
    });
  } catch {
    return { success: false, error: "unexpected" } satisfies Fail;
  }
}
