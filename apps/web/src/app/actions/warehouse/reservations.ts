"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import {
  InventoryReservationsService,
  type ActiveReservationLine,
  type ReservationEvent,
  type ReservationResult,
  type StockEngineError,
} from "@/server/services/inventory-reservations.service";

/**
 * Reservations (stage E4): reserve parts of a repair order from available
 * stock, release a reservation, transfer it to another repair order, read
 * the history. Org, branch and actor always come from the server context.
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

const reserveSchema = z.object({
  repairOrderId: z.string().uuid(),
  lines: z
    .array(
      z.object({
        repairOrderLineId: z.string().uuid(),
        locationId: z.string().uuid(),
        quantity: z.number().positive(),
        variantId: z.string().uuid().nullable().optional(),
      })
    )
    .min(1)
    .max(200),
  reason: z.string().trim().max(500).nullable().optional(),
});

export async function reserveForRepairOrderAction(
  rawInput: unknown
): Promise<{ success: true; data: ReservationResult } | Fail<StockEngineError | "invalid_input">> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = reserveSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryReservationsService.reserveForRepairOrder(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryReservationsService.reserveForRepairOrder>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

const releaseSchema = z.object({
  lines: z
    .array(
      z.object({
        reservationLineId: z.string().uuid(),
        quantity: z.number().positive().nullable().optional(),
      })
    )
    .min(1)
    .max(200),
  reason,
});

export async function releaseReservationLinesAction(
  rawInput: unknown
): Promise<
  { success: true; data: { releasedQuantity: number } } | Fail<StockEngineError | "invalid_input">
> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = releaseSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryReservationsService.releaseLines(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryReservationsService.releaseLines>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

const transferSchema = z.object({
  reservationLineId: z.string().uuid(),
  quantity: z.number().positive(),
  targetRepairOrderLineId: z.string().uuid(),
  reason,
});

export async function transferReservationAction(rawInput: unknown): Promise<
  | {
      success: true;
      data: { reservationId: string; reservationNumber: string; reservationLineId: string };
    }
  | Fail<StockEngineError | "invalid_input">
> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_OPERATE);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = transferSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    // zod output is all-optional under this tsconfig; the schema guarantees the shape.
    return InventoryReservationsService.transfer(supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      ...(parsed.data as Omit<
        Parameters<typeof InventoryReservationsService.transfer>[1],
        "actorUserId" | "organizationId" | "branchId"
      >),
    });
  } catch {
    return { success: false, error: "failed" };
  }
}

const listSchema = z.object({
  repairOrderLineIds: z.array(z.string().uuid()).max(500).optional(),
  variantId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
});

export async function listActiveReservationsAction(
  rawInput: unknown
): Promise<{ success: true; data: ActiveReservationLine[] } | Fail> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_READ);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = listSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    return InventoryReservationsService.listActive(
      supabase,
      scope.orgId,
      scope.branchId,
      parsed.data
    );
  } catch {
    return { success: false, error: "failed" };
  }
}

const historySchema = z
  .object({
    repairOrderLineIds: z.array(z.string().uuid()).max(500).optional(),
    reservationId: z.string().uuid().optional(),
  })
  .refine((v) => !!v.reservationId || (v.repairOrderLineIds?.length ?? 0) > 0);

export async function listReservationHistoryAction(
  rawInput: unknown
): Promise<{ success: true; data: ReservationEvent[] } | Fail> {
  try {
    const scope = await activeScope(WAREHOUSE_INVENTORY_READ);
    if (!scope) return { success: false, error: "unauthorized" };
    const parsed = historySchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const supabase = await createClient();
    return InventoryReservationsService.listHistory(
      supabase,
      scope.orgId,
      scope.branchId,
      parsed.data
    );
  } catch {
    return { success: false, error: "failed" };
  }
}
