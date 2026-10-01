"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { WAREHOUSE_INVENTORY_OPERATE, WAREHOUSE_INVENTORY_READ } from "@/lib/constants/permissions";
import {
  RepairOrderIssueService,
  type IssueCandidate,
  type IssueError,
  type IssueResult,
} from "@/server/services/repair-order-issue.service";

type Fail<E extends string = string> = { success: false; error: E };

/**
 * The repair order must be readable (RLS) and belong to the active branch;
 * org/branch are never taken from the caller.
 */
async function scopeFor(repairOrderId: string) {
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId ?? null;
  const branchId = context?.app.activeBranchId ?? null;
  const userId = context?.user.user?.id ?? null;
  if (!context || !orgId || !branchId || !userId) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("repair_orders")
    .select("id, branch_id")
    .eq("id", repairOrderId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();
  const row = data as { id: string; branch_id: string } | null;
  if (!row || row.branch_id !== branchId)
    return { context, supabase, orgId, branchId, userId, found: false };
  return { context, supabase, orgId, branchId, userId, found: true };
}

const repairOrderIdSchema = z.string().uuid();

/** Phase 10F -- what can be issued (RW) for this repair order right now. */
export async function listRepairOrderIssueCandidatesAction(
  repairOrderId: string
): Promise<{ success: true; data: IssueCandidate[] } | Fail> {
  try {
    if (!repairOrderIdSchema.safeParse(repairOrderId).success) {
      return { success: false, error: "Invalid input" };
    }
    const scope = await scopeFor(repairOrderId);
    if (!scope) return { success: false, error: "Unauthorized" };
    if (!checkPermission(scope.context.user.permissionSnapshot, WAREHOUSE_INVENTORY_READ)) {
      return { success: false, error: "Unauthorized" };
    }
    if (!scope.found) return { success: false, error: "Not found" };
    return RepairOrderIssueService.listCandidates(scope.supabase, repairOrderId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

const issueSchema = z.object({
  repairOrderId: z.string().uuid(),
  recipient: z.string().trim().min(1).max(200),
  note: z.string().max(1000).nullable().optional(),
  lines: z
    .array(
      z.object({
        kind: z.enum(["allocation", "reservation"]),
        sourceId: z.string().uuid(),
        repairOrderLineId: z.string().uuid(),
        quantity: z.number().positive(),
      })
    )
    .min(1),
});

/**
 * Phase 10F -- issue parts to the technician on one RW (261). Gated on
 * `warehouse.inventory.operate`; every line's ownership and quantity is
 * re-checked by `repair_order_issue_parts`.
 */
export async function issueRepairOrderPartsAction(
  rawInput: unknown
): Promise<{ success: true; data: IssueResult } | Fail<IssueError | "invalid_input">> {
  try {
    const parsed = issueSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "invalid_input" };
    const scope = await scopeFor(parsed.data.repairOrderId!);
    if (!scope) return { success: false, error: "unauthorized" };
    if (!checkPermission(scope.context.user.permissionSnapshot, WAREHOUSE_INVENTORY_OPERATE)) {
      return { success: false, error: "unauthorized" };
    }
    if (!scope.found) return { success: false, error: "not_found" };

    const result = await RepairOrderIssueService.issue(scope.supabase, {
      actorUserId: scope.userId,
      organizationId: scope.orgId,
      branchId: scope.branchId,
      repairOrderId: parsed.data.repairOrderId!,
      recipient: parsed.data.recipient!,
      note: parsed.data.note ?? null,
      lines: parsed.data.lines!.map((l) => ({
        kind: l.kind!,
        sourceId: l.sourceId!,
        repairOrderLineId: l.repairOrderLineId!,
        quantity: l.quantity!,
      })),
    });
    if (!result.success) {
      return {
        success: false,
        error: (result as { success: false; error: string }).error as IssueError,
      };
    }
    return result;
  } catch {
    return { success: false, error: "unexpected" };
  }
}
