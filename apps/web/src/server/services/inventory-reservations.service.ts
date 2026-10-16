import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Reservations (stage E4, docs/RESERVATIONS_BLOCKS_PLAN.md): R -- good parts
 * held for one repair order. Every write goes through an engine RPC that
 * checks warehouse.inventory.operate and writes the history
 * (inventory_reservation_events); this service only maps arguments, results
 * and errors.
 */

export type ServiceResult<T, E extends string = string> =
  | { success: true; data: T }
  | { success: false; error: E; message?: string };

/** Stable error codes the UI translates. */
export type StockEngineError =
  | "unauthorized"
  | "not_found"
  | "insufficient_stock"
  | "exceeds_need"
  | "reason_required"
  | "not_open"
  | "wrong_part"
  | "in_container"
  | "invalid_request"
  | "failed";

/** Maps an engine RPC error to a stable code; keeps the message for logs / details. */
export function mapStockEngineError(error: { code?: string; message?: string }): StockEngineError {
  const message = error.message ?? "";
  if (error.code === "42501" || error.code === "28000") return "unauthorized";
  if (error.code === "P0002") return "not_found";
  if (error.code === "55000") return "not_open";
  if (error.code === "P0003" || /insufficient|available/i.test(message))
    return "insufficient_stock";
  if (/reason/i.test(message)) return "reason_required";
  if (/still needs only/i.test(message)) return "exceeds_need";
  if (/different part|does not match/i.test(message)) return "wrong_part";
  if (/container/i.test(message)) return "in_container";
  if (error.code === "22023") return "invalid_request";
  return "failed";
}

function fail<T>(error: { code?: string; message?: string }): ServiceResult<T, StockEngineError> {
  return { success: false, error: mapStockEngineError(error), message: error.message };
}

type Scope = { actorUserId: string; organizationId: string; branchId: string };

export interface ReservationResult {
  reservationId: string;
  reservationNumber: string;
  lines: Array<{
    reservationLineId: string;
    repairOrderLineId: string;
    locationId: string;
    quantity: number;
  }>;
}

export interface ReservationEvent {
  id: string;
  eventType: "created" | "moved" | "allocated" | "issued" | "released" | "transferred";
  quantity: number;
  reservationId: string;
  reservationNumber: string | null;
  reservationLineId: string | null;
  repairOrderLineId: string | null;
  toRepairOrderLineId: string | null;
  locationId: string | null;
  toLocationId: string | null;
  movementId: string | null;
  blockId: string | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
}

export interface ActiveReservationLine {
  reservationLineId: string;
  reservationId: string;
  reservationNumber: string;
  repairOrderLineId: string | null;
  variantId: string;
  locationId: string;
  /** Still reserved (not released, not yet in a container / issued). */
  openQuantity: number;
  /** In a container of the order (allocated). */
  allocatedQuantity: number;
  createdAt: string;
}

const num = (v: unknown) => Number(v ?? 0);

export class InventoryReservationsService {
  /** "Zarezerwuj z magazynu": several parts of one repair order, one document. */
  static async reserveForRepairOrder(
    supabase: SupabaseClient,
    input: Scope & {
      repairOrderId: string;
      lines: Array<{
        repairOrderLineId: string;
        locationId: string;
        quantity: number;
        variantId?: string | null;
      }>;
      reason?: string | null;
    }
  ): Promise<ServiceResult<ReservationResult, StockEngineError>> {
    const { data, error } = await supabase.rpc("inventory_reserve_for_repair_order", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_repair_order_id: input.repairOrderId,
      p_lines: input.lines.map((l) => ({
        repair_order_line_id: l.repairOrderLineId,
        location_id: l.locationId,
        quantity: l.quantity,
        variant_id: l.variantId ?? null,
      })),
      p_reason: input.reason ?? null,
    });
    if (error) return fail(error);
    const r = (data ?? {}) as {
      reservation_id: string;
      reservation_number: string;
      lines?: Array<Record<string, unknown>>;
    };
    return {
      success: true,
      data: {
        reservationId: r.reservation_id,
        reservationNumber: r.reservation_number,
        lines: (r.lines ?? []).map((l) => ({
          reservationLineId: String(l.reservation_line_id),
          repairOrderLineId: String(l.repair_order_line_id),
          locationId: String(l.location_id),
          quantity: num(l.quantity),
        })),
      },
    };
  }

  /** R -> D, with a reason. A missing quantity releases what is left on the line. */
  static async releaseLines(
    supabase: SupabaseClient,
    input: Scope & {
      lines: Array<{ reservationLineId: string; quantity?: number | null }>;
      reason: string;
    }
  ): Promise<ServiceResult<{ releasedQuantity: number }, StockEngineError>> {
    const { data, error } = await supabase.rpc("inventory_release_reservation_lines", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_lines: input.lines.map((l) => ({
        reservation_line_id: l.reservationLineId,
        quantity: l.quantity ?? null,
      })),
      p_reason: input.reason,
    });
    if (error) return fail(error);
    return {
      success: true,
      data: { releasedQuantity: num((data as { released_quantity?: unknown })?.released_quantity) },
    };
  }

  /** Move a reserved quantity to another repair order's line (never through D). */
  static async transfer(
    supabase: SupabaseClient,
    input: Scope & {
      reservationLineId: string;
      quantity: number;
      targetRepairOrderLineId: string;
      reason: string;
    }
  ): Promise<
    ServiceResult<
      { reservationId: string; reservationNumber: string; reservationLineId: string },
      StockEngineError
    >
  > {
    const { data, error } = await supabase.rpc("inventory_transfer_reservation", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_reservation_line_id: input.reservationLineId,
      p_quantity: input.quantity,
      p_target_repair_order_line_id: input.targetRepairOrderLineId,
      p_reason: input.reason,
    });
    if (error) return fail(error);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        reservationId: String(r.reservation_id),
        reservationNumber: String(r.reservation_number),
        reservationLineId: String(r.reservation_line_id),
      },
    };
  }

  /** Reservation lines still holding stock, for repair-order lines or one item (RLS read). */
  static async listActive(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: { repairOrderLineIds?: string[]; variantId?: string; locationId?: string }
  ): Promise<ServiceResult<ActiveReservationLine[]>> {
    let query = supabase
      .from("inventory_reservation_lines")
      .select(
        `id, reservation_id, repair_order_line_id, variant_id, location_id, reserved_quantity,
         released_quantity, fulfilled_quantity, created_at,
         inventory_reservations!inner(reservation_number, status, deleted_at),
         inventory_allocation_lines(allocated_quantity, fulfilled_quantity)`
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .neq("inventory_reservations.status", "cancelled")
      .is("inventory_reservations.deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1000);
    if (filter.repairOrderLineIds?.length) {
      query = query.in("repair_order_line_id", filter.repairOrderLineIds);
    }
    if (filter.variantId) query = query.eq("variant_id", filter.variantId);
    if (filter.locationId) query = query.eq("location_id", filter.locationId);

    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load reservations" };

    const rows = (data ?? []) as unknown as Array<{
      id: string;
      reservation_id: string;
      repair_order_line_id: string | null;
      variant_id: string;
      location_id: string;
      reserved_quantity: unknown;
      released_quantity: unknown;
      fulfilled_quantity: unknown;
      created_at: string;
      inventory_reservations:
        | { reservation_number: string }
        | Array<{ reservation_number: string }>;
      inventory_allocation_lines: Array<{
        allocated_quantity: unknown;
        fulfilled_quantity: unknown;
      }>;
    }>;
    return {
      success: true,
      data: rows
        .map((row) => {
          const header = Array.isArray(row.inventory_reservations)
            ? row.inventory_reservations[0]
            : row.inventory_reservations;
          return {
            reservationLineId: row.id,
            reservationId: row.reservation_id,
            reservationNumber: header?.reservation_number ?? "",
            repairOrderLineId: row.repair_order_line_id,
            variantId: row.variant_id,
            locationId: row.location_id,
            openQuantity:
              num(row.reserved_quantity) - num(row.released_quantity) - num(row.fulfilled_quantity),
            allocatedQuantity: (row.inventory_allocation_lines ?? []).reduce(
              (sum, a) => sum + num(a.allocated_quantity) - num(a.fulfilled_quantity),
              0
            ),
            createdAt: row.created_at,
          };
        })
        .filter((l) => l.openQuantity > 0 || l.allocatedQuantity > 0),
    };
  }

  /** History of reservations: for repair-order lines, or one reservation document. */
  static async listHistory(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: { repairOrderLineIds?: string[]; reservationId?: string; limit?: number }
  ): Promise<ServiceResult<ReservationEvent[]>> {
    let query = supabase
      .from("inventory_reservation_events")
      .select(
        `id, event_type, quantity, reservation_id, reservation_line_id, repair_order_line_id,
         to_repair_order_line_id, location_id, to_location_id, movement_id, block_id, reason,
         actor_user_id, created_at, inventory_reservations(reservation_number)`
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: true })
      .limit(filter.limit ?? 500);
    if (filter.reservationId) query = query.eq("reservation_id", filter.reservationId);
    if (filter.repairOrderLineIds?.length) {
      const ids = filter.repairOrderLineIds.join(",");
      query = query.or(`repair_order_line_id.in.(${ids}),to_repair_order_line_id.in.(${ids})`);
    }

    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load reservation history" };

    return {
      success: true,
      data: ((data ?? []) as unknown as Array<Record<string, unknown>>).map((e) => {
        const header = e.inventory_reservations as
          | { reservation_number?: string }
          | Array<{ reservation_number?: string }>
          | null;
        const number = Array.isArray(header)
          ? header[0]?.reservation_number
          : header?.reservation_number;
        return {
          id: String(e.id),
          eventType: e.event_type as ReservationEvent["eventType"],
          quantity: num(e.quantity),
          reservationId: String(e.reservation_id),
          reservationNumber: number ?? null,
          reservationLineId: (e.reservation_line_id as string | null) ?? null,
          repairOrderLineId: (e.repair_order_line_id as string | null) ?? null,
          toRepairOrderLineId: (e.to_repair_order_line_id as string | null) ?? null,
          locationId: (e.location_id as string | null) ?? null,
          toLocationId: (e.to_location_id as string | null) ?? null,
          movementId: (e.movement_id as string | null) ?? null,
          blockId: (e.block_id as string | null) ?? null,
          reason: (e.reason as string | null) ?? null,
          actorUserId: (e.actor_user_id as string | null) ?? null,
          createdAt: String(e.created_at),
        };
      }),
    };
  }
}
