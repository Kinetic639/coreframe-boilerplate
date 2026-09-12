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

/**
 * Error normalization (external review correction): follows the exact,
 * already-established, hardened convention in
 * `repair-orders.service.ts`'s `normalizeMaterializationRpcError` --
 * NOT a bare passthrough of `error.message`. Each RPC deliberately RAISEs a
 * small number of fixed, safe, human-readable messages with a specific
 * ERRCODE; the allowlist below requires BOTH the exact code AND a match
 * against that RPC's own known message shape (not the errcode alone --
 * SQLSTATEs are broad Postgres error CLASSES, e.g. 42501/22023 are also
 * raised natively by Postgres itself for unrelated reasons, so an
 * errcode-only check could let a raw, schema-revealing native error through
 * under the same code). Anything that doesn't match both is logged
 * server-side (console.error -- this app has no other centralized server
 * logger this session found to reuse) and replaced with a generic,
 * client-safe message that leaks no SQL text, relation/function names,
 * UUIDs, or constraint internals.
 */
type DbLikeError = { code?: string; message: string };

const RECEIVE_RPC_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "28000", pattern: /^p_actor_user_id must match the authenticated caller$/ },
  { code: "42501", pattern: /^Not authorized to receive stock for this branch$/ },
  { code: "22023", pattern: /^At least one line is required$/ },
  { code: "P0002", pattern: /^No active receiving location configured for this branch/ },
  { code: "P0002", pattern: /did not resolve to any RepairOrderLine/ },
  { code: "55000", pattern: /resolved ambiguously to \d+ RepairOrderLine candidates/ },
  {
    code: "42501",
    pattern:
      /Resolved RepairOrder for line \d+ does not belong to the target organization\/branch$/,
  },
  {
    code: "22023",
    pattern: /Resolved RepairOrderLine variant for line \d+ does not match the received variant$/,
  },
];

const PUTAWAY_RPC_KNOWN_ERRORS: ReadonlyArray<{ code: string; pattern: RegExp }> = [
  { code: "28000", pattern: /^p_actor_user_id must match the authenticated caller$/ },
  { code: "42501", pattern: /^Not authorized to putaway stock for this branch$/ },
  { code: "22023", pattern: /^At least one line is required$/ },
  { code: "22023", pattern: /^A destination location is required$/ },
  { code: "P0002", pattern: /^No active receiving location configured for this branch/ },
  { code: "22023", pattern: /is not a valid stockable location for this branch$/ },
  { code: "22023", pattern: /^Destination cannot be the receiving location itself$/ },
  { code: "22023", pattern: /is missing repair_order_line_id/ },
  { code: "22023", pattern: /quantity must be positive$/ },
  { code: "42501", pattern: /does not belong to this organization\/branch$/ },
  { code: "22023", pattern: /variant does not match the RepairOrderLine's own variant$/ },
  { code: "22023", pattern: /but only .* is currently attributed to this RepairOrderLine/ },
  {
    code: "55000",
    pattern:
      /attribution for this variant is UNKNOWN .* putaway is not permitted until it is reconciled$/,
  },
];

const GENERIC_RECEIVE_ERROR =
  "Receiving failed due to an unexpected server error. Please try again or contact support.";
const GENERIC_PUTAWAY_ERROR =
  "Putaway failed due to an unexpected server error. Please try again or contact support.";
const GENERIC_STORAGE_ERROR =
  "Could not load current storage information. Please try again or contact support.";

function normalizeRpcError(
  error: DbLikeError,
  allowlist: ReadonlyArray<{ code: string; pattern: RegExp }>,
  genericMessage: string,
  context: string
): string {
  const isKnown = allowlist.some(
    (known) => error.code === known.code && known.pattern.test(error.message)
  );
  if (isKnown) return error.message;
  console.error(`[zone5:${context}] unexpected DB error`, error);
  return genericMessage;
}

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

    if (error)
      return {
        success: false as const,
        error: normalizeRpcError(error, RECEIVE_RPC_KNOWN_ERRORS, GENERIC_RECEIVE_ERROR, "receive"),
      };
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

    if (error)
      return {
        success: false as const,
        error: normalizeRpcError(error, PUTAWAY_RPC_KNOWN_ERRORS, GENERIC_PUTAWAY_ERROR, "putaway"),
      };
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
      // The read model's own errors are plain Supabase SELECT failures (no
      // deliberately-authored safe messages exist for it, unlike the two
      // RPCs above) -- every failure here is treated as unexpected: logged
      // server-side, replaced with a generic message before reaching the
      // client. The one narrow exception (matching the older, established
      // normalizeDbError pattern already used elsewhere in this codebase --
      // e.g. wdd-matcher.service.ts) is a recognizable RLS/permission
      // denial, which is itself already a safe, generic statement.
      const isRlsDenial = /row-level security|permission denied/i.test(result.error);
      if (!isRlsDenial) {
        console.error("[zone5:storage] unexpected DB error", result.error);
      }
      return {
        success: false as const,
        error: isRlsDenial
          ? "You do not have permission to view this data."
          : GENERIC_STORAGE_ERROR,
      };
    }
  } catch (error) {
    return mapUnexpected(error);
  }
}
