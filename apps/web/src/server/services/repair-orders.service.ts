import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eventService } from "./event.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Typed, clean result of a materialization call -- the raw jsonb shape
 * returned by the materialize_repair_orders_from_session RPC, mapped to a
 * domain type so callers never depend on the RPC's raw jsonb keys directly.
 */
export interface MaterializationResult {
  sessionId: string;
  createdRepairOrders: number;
  reusedRepairOrders: number;
  createdSourceDocuments: number;
  reusedSourceDocuments: number;
  createdSourceDocumentLines: number;
  createdDocumentLinks: number;
  createdLogicalLines: number;
  createdLineLinks: number;
  skippedNonPositiveQuantityLines: number;
  /** True when this call found nothing new to do (safe idempotent replay). */
  alreadyMaterialized: boolean;
}

interface MaterializeRpcRow {
  session_id: string;
  created_repair_orders: number;
  reused_repair_orders: number;
  created_source_documents: number;
  reused_source_documents: number;
  created_source_document_lines: number;
  created_document_links: number;
  created_logical_lines: number;
  created_line_links: number;
  skipped_nonpositive_quantity_lines: number;
  already_materialized: boolean;
}

function mapMaterializationResult(row: MaterializeRpcRow): MaterializationResult {
  return {
    sessionId: row.session_id,
    createdRepairOrders: row.created_repair_orders,
    reusedRepairOrders: row.reused_repair_orders,
    createdSourceDocuments: row.created_source_documents,
    reusedSourceDocuments: row.reused_source_documents,
    createdSourceDocumentLines: row.created_source_document_lines,
    createdDocumentLinks: row.created_document_links,
    createdLogicalLines: row.created_logical_lines,
    createdLineLinks: row.created_line_links,
    skippedNonPositiveQuantityLines: row.skipped_nonpositive_quantity_lines,
    alreadyMaterialized: row.already_materialized,
  };
}

// ---------------------------------------------------------------------------
// RepairOrdersService
// ---------------------------------------------------------------------------

export class RepairOrdersService {
  /**
   * Materialize RepairOrders from an approved Matcher session.
   *
   * Calls the atomic SECURITY DEFINER RPC materialize_repair_orders_from_session
   * (apps/web/supabase-target/supabase/migrations/20260910075814_repair_orders_materialization_rpc.sql).
   * The RPC itself is the single, all-or-nothing transaction boundary for
   * every domain write (RepairOrders, logical lines, source documents/lines,
   * provenance links) -- this method does not perform any additional
   * Supabase calls that would need to stay in sync with it.
   *
   * Idempotent: safe to call more than once for the same session (e.g. a
   * UI retry after a network error) -- a repeat call returns
   * alreadyMaterialized: true with every created* count at 0, per the RPC's
   * own DB-level idempotency (unique constraints + ON CONFLICT), not any
   * client-side guard.
   *
   * Event emission (Mode A, best-effort, per docs/event-system/README.md):
   * on success, this method calls eventService.emit() AFTER the RPC commits.
   * If emission fails, the domain write already succeeded and is preserved
   * -- the failure is only logged, matching the documented Mode A trade-off.
   * The RPC's own transaction does not attempt DB-side (Mode B) event
   * emission, since Mode B requires the pre-validation/registration
   * machinery this codebase has not yet built for Zone 3 -- preserving the
   * existing event-system architecture rather than forking a parallel one.
   */
  static async materializeFromSession(
    supabase: SupabaseClient,
    actorUserId: string,
    sessionId: string
  ): Promise<ServiceResult<MaterializationResult>> {
    const { data, error } = await supabase.rpc("materialize_repair_orders_from_session", {
      p_actor_user_id: actorUserId,
      p_session_id: sessionId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    const result = mapMaterializationResult(data as MaterializeRpcRow);

    const emitResult = await eventService.emit({
      actionKey: "workshop.repair_orders.materialized",
      actorType: "user",
      actorUserId,
      entityType: "wdd_matcher_session",
      entityId: sessionId,
      metadata: {
        createdRepairOrders: result.createdRepairOrders,
        reusedRepairOrders: result.reusedRepairOrders,
        createdSourceDocuments: result.createdSourceDocuments,
        createdLogicalLines: result.createdLogicalLines,
        alreadyMaterialized: result.alreadyMaterialized,
      },
      eventTier: "baseline",
    });

    if (!emitResult.success) {
      // Best-effort per Mode A -- the domain write above already succeeded
      // and is returned to the caller regardless of this failure.
      // Cast needed: apps/web's tsconfig strictNullChecks setup does not
      // narrow this discriminated union from `if (!x.success)` alone (known
      // repo-wide quirk -- see actions.ts's own eventService.emit() caller
      // for the same pattern).
      console.error(
        "[RepairOrdersService.materializeFromSession] Failed to emit workshop.repair_orders.materialized:",
        (emitResult as { success: false; error: string }).error
      );
    }

    return { success: true, data: result };
  }
}
