"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  QR_ASSIGN,
  WAREHOUSE_INVENTORY_OPERATE,
  WAREHOUSE_INVENTORY_READ,
} from "@/lib/constants/permissions";
import { QrAssignmentsService } from "@/server/services/qr.service";
import {
  PutawayScanService,
  type LocationChange,
  type LocationContents,
  type PutawayBatchError,
  type PutawayBatchResult,
  type ScannedContainer,
} from "@/server/services/putaway-scan.service";

type Fail<E extends string = string> = { success: false; error: E };

/** org, branch and actor always come from the active server context. */
async function scope(permission: string) {
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? null;
  const branchId = context?.app.activeBranchId ?? null;
  const userId = context?.user.user?.id ?? null;
  if (!context || !orgId || !branchId || !userId) return null;
  if (!checkPermission(context.user.permissionSnapshot, permission)) return null;
  return { context, orgId, branchId, userId, supabase: await createClient() };
}

const uuid = z.string().uuid();

/** A scanned container sticker: its repair order and location (or null). */
export async function getScannedContainerAction(
  containerId: string
): Promise<{ success: true; data: ScannedContainer | null } | Fail> {
  try {
    if (!uuid.safeParse(containerId).success) return { success: false, error: "invalid_input" };
    const s = await scope(WAREHOUSE_INVENTORY_READ);
    if (!s) return { success: false, error: "unauthorized" };
    return PutawayScanService.getContainer(s.supabase, s.orgId, s.branchId, containerId);
  } catch {
    return { success: false, error: "unexpected" };
  }
}

/** A scanned location: containers and loose stock lying there (or null). */
export async function getLocationContentsAction(
  locationId: string
): Promise<{ success: true; data: LocationContents | null } | Fail> {
  try {
    if (!uuid.safeParse(locationId).success) return { success: false, error: "invalid_input" };
    const s = await scope(WAREHOUSE_INVENTORY_READ);
    if (!s) return { success: false, error: "unauthorized" };
    return PutawayScanService.getLocationContents(s.supabase, s.orgId, s.branchId, locationId);
  } catch {
    return { success: false, error: "unexpected" };
  }
}

const batchSchema = z
  .object({
    locationId: uuid.nullable(),
    containerId: uuid.nullable(),
    newContainerRepairOrderId: uuid.nullable(),
    /** A fresh sticker to bind to the new container. */
    qrCodeId: uuid.nullable().optional(),
    lines: z
      .array(
        z.object({
          variantId: uuid,
          quantity: z.number().positive(),
          repairOrderLineId: uuid.nullable(),
        })
      )
      .min(1)
      .max(200),
  })
  .refine((v) => !!v.containerId || !!v.locationId, { message: "destination required" });

/**
 * Put several receiving-zone items away in one step: into an existing
 * repair-order container, into a new one (bound to a fresh sticker if one
 * was scanned), or onto a location. All lines commit together.
 */
export async function putawayBatchAction(
  rawInput: unknown
): Promise<
  | { success: true; data: PutawayBatchResult & { qrAssigned: boolean | null } }
  | Fail<PutawayBatchError | "invalid_input">
> {
  try {
    const parsed = batchSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const s = await scope(WAREHOUSE_INVENTORY_OPERATE);
    if (!s) return { success: false, error: "unauthorized" };
    const input = parsed.data;

    const result = await PutawayScanService.putawayBatch(s.supabase, {
      actorUserId: s.userId,
      organizationId: s.orgId,
      branchId: s.branchId,
      locationId: input.locationId ?? null,
      containerId: input.containerId ?? null,
      newContainerRepairOrderId: input.newContainerRepairOrderId ?? null,
      lines: input.lines!.map((l) => ({
        variantId: l.variantId!,
        quantity: l.quantity!,
        repairOrderLineId: l.repairOrderLineId ?? null,
      })),
    });
    if (!result.success) {
      return {
        success: false,
        error: (result as { error: string }).error as PutawayBatchError,
      };
    }

    // Bind the scanned sticker to the new container. The putaway itself
    // already committed; a failed bind leaves a container without a sticker,
    // which can be fixed from the container page.
    let qrAssigned: boolean | null = null;
    if (input.qrCodeId && result.data.containerCreated && result.data.containerId) {
      qrAssigned = false;
      if (checkPermission(s.context.user.permissionSnapshot, QR_ASSIGN)) {
        const bind = await QrAssignmentsService.assignToTarget(s.supabase, {
          qrCodeId: input.qrCodeId,
          targetType: "inventory.container",
          targetId: result.data.containerId,
          assignedBy: s.userId,
          permissionSnapshot: s.context.user.permissionSnapshot,
        });
        qrAssigned = bind.success;
      }
    }
    return { success: true, data: { ...result.data, qrAssigned } };
  } catch {
    return { success: false, error: "unexpected" };
  }
}

/** Repair orders whose locations changed since `since` (ISO), for AutoStacja. */
export async function listLocationChangesAction(
  since: string
): Promise<{ success: true; data: LocationChange[] } | Fail> {
  try {
    if (!z.string().datetime({ offset: true }).safeParse(since).success) {
      return { success: false, error: "invalid_input" };
    }
    const s = await scope(WAREHOUSE_INVENTORY_READ);
    if (!s) return { success: false, error: "unauthorized" };
    return PutawayScanService.listLocationChanges(s.supabase, s.orgId, s.branchId, since);
  } catch {
    return { success: false, error: "unexpected" };
  }
}
