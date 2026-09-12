"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  WORKSHOP_REPAIR_ORDERS_READ,
  WORKSHOP_REPAIR_ORDERS_MANAGE_OWN,
  WORKSHOP_REPAIR_ORDERS_MANAGE_ALL,
} from "@repo/contracts/permissions";
import {
  RepairOrdersService,
  type RepairOrderHeader,
  type RepairOrderAdvisorCandidate,
} from "@/server/services/repair-orders.service";
import { canTransitionRepairOrderStatus } from "@/lib/types/repair-orders";
import {
  createRepairOrderSchema,
  updateRepairOrderHeaderSchema,
  assignRepairOrderAdvisorSchema,
  changeRepairOrderStatusSchema,
} from "@/lib/validations/repair-orders";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, context: null };
  const context = await loadDashboardContextV2();
  return { supabase, user, context };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Phase 7 -- manual RepairOrder header creation. Requires
 * manage_own OR manage_all (matching repair_orders_insert's own RLS WITH
 * CHECK gate). org/branch are always the caller's trusted server-side
 * active context -- never accepted from the client. A manage_own-only
 * caller's advisor_contact_id selection is pre-validated here (clear error
 * instead of a confusing RLS failure) -- repair_orders_insert's RLS WITH
 * CHECK remains the authoritative enforcement of the identical rule.
 */
export async function createRepairOrderAction(
  rawInput: unknown
): Promise<ActionResult<RepairOrderHeader>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    const branchId = context?.app.activeBranchId ?? null;
    if (!branchId) {
      return {
        success: false,
        error: "No active branch -- select a branch before creating a RepairOrder",
      };
    }

    const snapshot = context.user.permissionSnapshot;
    const hasManageOwn = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN);
    const hasManageAll = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);
    if (!hasManageOwn && !hasManageAll) return { success: false, error: "Unauthorized" };

    const parsed = createRepairOrderSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    if (!hasManageAll && parsed.data.advisor_contact_id) {
      const ownContactResult = await RepairOrdersService.getOwnAdvisorContactId(supabase, orgId);
      const ownContactId = ownContactResult.success ? ownContactResult.data : null;
      if (parsed.data.advisor_contact_id !== ownContactId) {
        return {
          success: false,
          error: "You may only assign yourself as advisor without manage_all permission",
        };
      }
    }

    return RepairOrdersService.createRepairOrder(supabase, orgId, branchId, user.id, parsed.data);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Header edit
// ---------------------------------------------------------------------------

export async function updateRepairOrderHeaderAction(
  rawInput: unknown
): Promise<ActionResult<RepairOrderHeader>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    const branchId = context?.app.activeBranchId ?? null;

    const snapshot = context.user.permissionSnapshot;
    const canManage =
      checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN) ||
      checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);
    if (!canManage) return { success: false, error: "Unauthorized" };

    const parsed = updateRepairOrderHeaderSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const { id, ...patch } = parsed.data;

    return RepairOrdersService.updateHeader(supabase, orgId, branchId, user.id, id, patch);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Advisor assignment
// ---------------------------------------------------------------------------

/**
 * Phase 7 -- reassign (or clear) a RepairOrder's advisor. Gated on
 * manage_all explicitly: repair_orders_update's own RLS WITH CHECK means a
 * manage_own-only actor can never successfully change advisor_contact_id
 * to anything other than their own already-assigned value (a no-op) --
 * this pre-check turns that into a clear "Unauthorized" instead of a
 * confusing silent-no-op/RLS-violation surfaced from the DB layer.
 */
export async function assignRepairOrderAdvisorAction(
  rawInput: unknown
): Promise<ActionResult<RepairOrderHeader>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    const branchId = context?.app.activeBranchId ?? null;

    if (!checkPermission(context.user.permissionSnapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL)) {
      return { success: false, error: "Unauthorized" };
    }

    const parsed = assignRepairOrderAdvisorSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    return RepairOrdersService.assignAdvisor(
      supabase,
      orgId,
      branchId,
      user.id,
      parsed.data.id,
      parsed.data.advisorContactId
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Phase 7 -- open/closed/archived lifecycle transition. Uses the existing,
 * authoritative canTransitionRepairOrderStatus domain helper to reject an
 * illegal transition with a clear message BEFORE reaching the DB; requires
 * manage_all specifically when the target is 'archived' (matching
 * repair_orders_update's own RLS restriction, checked here first for a
 * clearer error than a raw RLS failure would give).
 */
export async function changeRepairOrderStatusAction(
  rawInput: unknown
): Promise<ActionResult<RepairOrderHeader>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    const branchId = context?.app.activeBranchId ?? null;

    const snapshot = context.user.permissionSnapshot;
    const hasManageOwn = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN);
    const hasManageAll = checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL);
    if (!hasManageOwn && !hasManageAll) return { success: false, error: "Unauthorized" };

    const parsed = changeRepairOrderStatusSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
    const { id, fromStatus, toStatus } = parsed.data;

    if (
      !canTransitionRepairOrderStatus(
        fromStatus as "open" | "closed" | "archived",
        toStatus as "open" | "closed" | "archived",
        hasManageAll
      )
    ) {
      return {
        success: false,
        error: hasManageAll
          ? `Invalid transition: ${fromStatus} -> ${toStatus}`
          : `Invalid transition: ${fromStatus} -> ${toStatus} (archiving requires the manage_all permission)`,
      };
    }

    return RepairOrdersService.changeStatus(
      supabase,
      orgId,
      branchId,
      user.id,
      id,
      fromStatus as "open" | "closed" | "archived",
      toStatus as "open" | "closed" | "archived"
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Advisor picker
// ---------------------------------------------------------------------------

export async function listAdvisorCandidatesAction(): Promise<
  ActionResult<RepairOrderAdvisorCandidate[]>
> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };

    const snapshot = context.user.permissionSnapshot;
    const canManage =
      checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_OWN) ||
      checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_MANAGE_ALL) ||
      checkPermission(snapshot, WORKSHOP_REPAIR_ORDERS_READ);
    if (!canManage) return { success: false, error: "Unauthorized" };

    return RepairOrdersService.listAdvisorCandidates(supabase, orgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
