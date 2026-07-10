"use server";

import { createClient } from "@/utils/supabase/server";
import {
  WAREHOUSE_AUDITS_MANAGE,
  WAREHOUSE_AUDITS_READ,
  WAREHOUSE_REPORTS_READ,
} from "@/lib/constants/permissions";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import {
  enrichCountLines,
  enrichReorderReportRows,
} from "@/server/services/warehouse-audit-enrichment.service";
import {
  emitInventoryEvent,
  hasPermission,
  mapUnexpected,
  requireActiveBranch,
  requireWarehouseContext,
  textFromRecord,
  userIdFrom,
} from "./action-context";
import {
  addUnexpectedCountLineSchema,
  approveCountSessionSchema,
  bulkApproveCountLinesSchema,
  createCountSessionSchema,
  getReorderReportSchema,
  listCountSessionsSchema,
  setReorderSuggestionActionSchema,
  updateCountLineSchema,
  updateCountSessionStatusSchema,
} from "./schemas";

// All reads below require WAREHOUSE_AUDITS_READ, all writes require
// WAREHOUSE_AUDITS_MANAGE. Final posting (approveInventoryCountSessionAction)
// is intentionally NOT additionally gated on warehouse.inventory.adjust
// here — that check lives inside inventory_approve_count_session itself
// (decision #3, separation of duties), so the rejection reason surfaces
// clearly from the RPC rather than being duplicated/generalized here.

export async function listInventoryCountSessionsAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_READ))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = listCountSessionsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    return await InventoryCountSessionsService.listSessions(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      parsed.data
    );
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function getInventoryCountSessionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_READ))
      return { success: false, error: "Unauthorized" };
    const parsed = approveCountSessionSchema.safeParse(rawInput); // shape is just { id }
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    const detail = await InventoryCountSessionsService.getSessionDetail(supabase, parsed.data.id);
    if (!detail.success) return detail;

    const enrichedLines = await enrichCountLines(supabase, detail.data.lines);
    return { success: true, data: { session: detail.data.session, lines: enrichedLines } };
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function createInventoryCountSessionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = createCountSessionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();

    let allLocations: { id: string; parent_id: string | null }[] = [];
    if (parsed.data.scope.count_type === "location") {
      const locationsResult = await WarehouseLocationsService.listByBranch(
        supabase,
        auth.context.app.activeOrgId,
        branch.branchId
      );
      if (!locationsResult.success)
        return {
          success: false,
          error: (locationsResult as { success: false; error: string }).error,
        };
      allLocations = locationsResult.data.map((loc) => ({ id: loc.id, parent_id: loc.parent_id }));
    }

    const result = await InventoryCountSessionsService.createCountSession(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      {
        count_type: parsed.data.scope.count_type,
        location_ids: parsed.data.scope.location_ids,
        include_children: parsed.data.scope.include_children,
        supplier_id: parsed.data.scope.supplier_id,
        location_filter_ids: parsed.data.scope.location_filter_ids,
        include_zero_stock: parsed.data.scope.include_zero_stock,
        show_expected_quantity: parsed.data.scope.show_expected_quantity,
        require_reason_for_variance: parsed.data.scope.require_reason_for_variance,
        notes: parsed.data.notes,
        actor_user_id: userId,
      },
      allLocations
    );

    const countSessionId = textFromRecord(result.success ? result.data : null, [
      "count_session_id",
      "id",
    ]);
    if (result.success && countSessionId) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_session.created",
        entityType: "inventory_count_session",
        entityId: countSessionId,
        branchId: branch.branchId,
        metadata: { count_session_id: countSessionId, scope: parsed.data.scope },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryCountLineAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateCountLineSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryCountSessionsService.updateCountLine(supabase, parsed.data.id, {
      counted_quantity: parsed.data.counted_quantity,
      variance_quantity: parsed.data.variance_quantity,
      status: parsed.data.status,
      current_status: parsed.data.current_status,
      reason_code: parsed.data.reason_code,
      note: parsed.data.note,
      require_reason_for_variance: parsed.data.require_reason_for_variance,
      actor_user_id: userId,
    });

    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_line.updated",
        entityType: "inventory_count_line",
        entityId: parsed.data.id,
        metadata: {
          count_line_id: parsed.data.id,
          counted_quantity: parsed.data.counted_quantity,
          status: parsed.data.status,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function updateInventoryCountSessionStatusAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = updateCountSessionStatusSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryCountSessionsService.updateSessionStatus(
      supabase,
      parsed.data.id,
      parsed.data.status
    );

    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_session.status_updated",
        entityType: "inventory_count_session",
        entityId: parsed.data.id,
        metadata: { count_session_id: parsed.data.id, status: parsed.data.status },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function addUnexpectedCountLineAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = addUnexpectedCountLineSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryCountSessionsService.addUnexpectedLine(
      supabase,
      parsed.data.count_session_id,
      {
        organization_id: auth.context.app.activeOrgId,
        branch_id: branch.branchId,
        variant_id: parsed.data.variant_id,
        location_id: parsed.data.location_id,
        unit_id: parsed.data.unit_id,
        counted_quantity: parsed.data.counted_quantity,
        note: parsed.data.note,
        actor_user_id: userId,
      }
    );

    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_line.unexpected_added",
        entityType: "inventory_count_line",
        entityId: result.data.id,
        branchId: branch.branchId,
        metadata: {
          count_session_id: parsed.data.count_session_id,
          variant_id: parsed.data.variant_id,
          location_id: parsed.data.location_id,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function bulkApproveCountLinesAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = bulkApproveCountLinesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    const result = await InventoryCountSessionsService.bulkApproveLines(
      supabase,
      parsed.data.line_ids,
      {
        require_reason_for_variance: parsed.data.require_reason_for_variance,
      }
    );

    if (result.success && result.data.approvedIds.length > 0) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_line.bulk_approved",
        entityType: "inventory_count_line",
        entityId: result.data.approvedIds[0],
        metadata: {
          approved_ids: result.data.approvedIds,
          skipped_ids: result.data.skippedIds,
        },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function approveInventoryCountSessionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const parsed = approveCountSessionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    // The RPC itself independently requires warehouse.inventory.adjust
    // (decision #3) — this is intentionally not re-checked here so that a
    // user with only warehouse.audits.manage gets the RPC's own clear
    // rejection message rather than a generic "Unauthorized" from this layer.
    const result = await InventoryCountSessionsService.approveCountSession(
      supabase,
      parsed.data.id,
      userId
    );

    if (result.success) {
      await emitInventoryEvent(auth, userId, {
        actionKey: "warehouse.inventory.count_session.approved",
        entityType: "inventory_count_session",
        entityId: parsed.data.id,
        metadata: { count_session_id: parsed.data.id },
      });
    }
    return result;
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function setReorderSuggestionActionAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_AUDITS_MANAGE))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = setReorderSuggestionActionSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const userId = userIdFrom(auth);
    const supabase = await createClient();
    return await InventoryCountSessionsService.setReorderSuggestionAction(supabase, {
      organization_id: auth.context.app.activeOrgId,
      branch_id: branch.branchId,
      variant_id: parsed.data.variant_id,
      location_id: parsed.data.location_id,
      status: parsed.data.status,
      actor_user_id: userId,
      count_session_id: parsed.data.count_session_id ?? null,
    });
  } catch (error) {
    return mapUnexpected(error);
  }
}

export async function getReorderReportAction(rawInput: unknown) {
  try {
    const auth = await requireWarehouseContext();
    if (!auth.success) return auth;
    if (!hasPermission(auth, WAREHOUSE_REPORTS_READ))
      return { success: false, error: "Unauthorized" };
    const branch = requireActiveBranch(auth);
    if (!branch.success) return branch;
    const parsed = getReorderReportSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const supabase = await createClient();
    const result = await InventoryCountSessionsService.getReorderReport(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      parsed.data
    );
    if (!result.success) return result;

    const enrichedRows = await enrichReorderReportRows(
      supabase,
      auth.context.app.activeOrgId,
      branch.branchId,
      result.data
    );
    return { success: true, data: enrichedRows };
  } catch (error) {
    return mapUnexpected(error);
  }
}
