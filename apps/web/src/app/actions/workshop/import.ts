"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WORKSHOP_REPAIR_ORDERS_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
} from "@repo/contracts/permissions";
import {
  RepairOrderImportService,
  type RepairOrderImportPreview,
  type RepairOrderImportResult,
  type RepairOrderImportSource,
} from "@/server/services/repair-order-import.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/** org/branch always come from the caller's active context, never the client. */
async function importContext(requireManage: boolean) {
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? null;
  const branchId = context?.app.activeBranchId ?? null;
  const userId = context?.user.user?.id ?? null;
  if (!context || !orgId || !branchId || !userId) return null;
  const snapshot = context.user.permissionSnapshot;
  const allowed = requireManage
    ? checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN) ||
      checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL)
    : checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_READ);
  if (!allowed) return null;
  return { supabase: await createClient(), orgId, branchId, userId };
}

const sourceSchema = z.object({
  source_type: z.string().trim().min(1).max(60),
  source_input: z.record(z.unknown()).default({}),
});

export async function listRepairOrderImportSourcesAction(): Promise<
  ActionResult<RepairOrderImportSource[]>
> {
  try {
    const scope = await importContext(false);
    if (!scope) return { success: false, error: "unauthorized" };
    return RepairOrderImportService.listSources(scope.supabase, scope.orgId, scope.branchId);
  } catch {
    return { success: false, error: "unexpected" };
  }
}

/** Verify a source's orders against the branch: existing / new / conflict. */
export async function previewRepairOrderImportAction(
  rawInput: unknown
): Promise<ActionResult<RepairOrderImportPreview>> {
  try {
    const parsed = sourceSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const scope = await importContext(false);
    if (!scope) return { success: false, error: "unauthorized" };
    return RepairOrderImportService.preview(
      scope.supabase,
      scope.orgId,
      scope.branchId,
      parsed.data.source_type!,
      parsed.data.source_input ?? {}
    );
  } catch {
    return { success: false, error: "unexpected" };
  }
}

const applySchema = sourceSchema.extend({
  zl_numbers: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
});

/** Create/update the selected ZLs from the source (re-read server-side). */
export async function applyRepairOrderImportAction(
  rawInput: unknown
): Promise<ActionResult<RepairOrderImportResult>> {
  try {
    const parsed = applySchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const scope = await importContext(true);
    if (!scope) return { success: false, error: "unauthorized" };
    return RepairOrderImportService.apply(scope.supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      sourceType: parsed.data.source_type!,
      sourceInput: parsed.data.source_input ?? {},
      zlNumbers: parsed.data.zl_numbers!,
    });
  } catch {
    return { success: false, error: "unexpected" };
  }
}
