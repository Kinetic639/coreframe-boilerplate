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

/** A history event with what the screens show next to it. */
export interface ReservationEventView extends ReservationEvent {
  movementNumber: string | null;
  actorName: string | null;
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

type Row = Record<string, unknown>;
const one = (v: unknown): Row | null =>
  Array.isArray(v) ? ((v[0] as Row | undefined) ?? null) : ((v as Row | null) ?? null);

/** An active reservation line with what the screens show next to it. */
export interface ReservationLineView extends ActiveReservationLine {
  sku: string | null;
  productId: string | null;
  productName: string | null;
  unitCode: string | null;
  locationCode: string | null;
  locationName: string | null;
  /** e.g. 'receiving' for the receiving zone. */
  locationPurpose: string | null;
  repairOrderId: string | null;
  zlNumber: string | null;
  clientName: string | null;
  partName: string | null;
  /** The internal order (ZW) the line is reserved under -- the order of a ZW without repair order. */
  internalOrderId?: string | null;
  internalOrderNumber?: string | null;
  internalOrderDestination?: string | null;
}

/** A repair-order line that still needs a part (reserve / transfer target). */
export interface RepairOrderLineNeed {
  repairOrderLineId: string;
  repairOrderId: string;
  zlNumber: string | null;
  clientName: string | null;
  productCode: string | null;
  productName: string | null;
  variantId: string | null;
  orderedQuantity: number;
  openNeed: number;
}

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

  /**
   * Move reserved parts to lines of ONE other repair order (never through D):
   * one new REZ for the target order, a line per part. A null quantity moves
   * all that is left on that reservation line.
   */
  static async transfer(
    supabase: SupabaseClient,
    input: Scope & {
      lines: Array<{
        reservationLineId: string;
        quantity?: number | null;
        targetRepairOrderLineId: string;
      }>;
      reason: string;
    }
  ): Promise<
    ServiceResult<
      { reservationId: string; reservationNumber: string; reservationLineIds: string[] },
      StockEngineError
    >
  > {
    const { data, error } = await supabase.rpc("inventory_transfer_reservation_lines", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_lines: input.lines.map((l) => ({
        reservation_line_id: l.reservationLineId,
        quantity: l.quantity ?? null,
        target_repair_order_line_id: l.targetRepairOrderLineId,
      })),
      p_reason: input.reason,
    });
    if (error) return fail(error);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        reservationId: String(r.reservation_id),
        reservationNumber: String(r.reservation_number),
        reservationLineIds: ((r.lines ?? []) as Array<Record<string, unknown>>).map((l) =>
          String(l.reservation_line_id)
        ),
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

  /** Active reservations of the branch with part, location and repair order (RLS read). */
  static async listActiveDetailed(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: { variantIds?: string[]; repairOrderLineIds?: string[] } = {}
  ): Promise<ServiceResult<ReservationLineView[]>> {
    let query = supabase
      .from("inventory_reservation_lines")
      .select(
        `id, reservation_id, repair_order_line_id, variant_id, location_id, reserved_quantity,
         released_quantity, fulfilled_quantity, created_at,
         inventory_reservations!inner(reservation_number, status, deleted_at),
         inventory_allocation_lines(allocated_quantity, fulfilled_quantity),
         inventory_variants(sku, product_id, inventory_products!inventory_variants_product_fk(name, inventory_units(code))),
         warehouse_locations(code, name, purpose),
         repair_order_lines(product_name, repair_orders(id, zl_number, client_name)),
         internal_order_lines(internal_orders(id, order_number, destination_code, client_name))`
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .neq("inventory_reservations.status", "cancelled")
      .is("inventory_reservations.deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(2000);
    if (filter.variantIds?.length) query = query.in("variant_id", filter.variantIds);
    if (filter.repairOrderLineIds?.length) {
      query = query.in("repair_order_line_id", filter.repairOrderLineIds);
    }
    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load reservations" };

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return {
      success: true,
      data: rows
        .map((row) => {
          const header = one(row.inventory_reservations);
          const variant = one(row.inventory_variants);
          const product = one(variant?.inventory_products);
          const unit = one(product?.inventory_units);
          const location = one(row.warehouse_locations);
          const rol = one(row.repair_order_lines);
          const ro = one(rol?.repair_orders);
          const io = one(one(row.internal_order_lines)?.internal_orders);
          const allocations = (row.inventory_allocation_lines ?? []) as Array<
            Record<string, unknown>
          >;
          return {
            reservationLineId: String(row.id),
            reservationId: String(row.reservation_id),
            reservationNumber: String(header?.reservation_number ?? ""),
            repairOrderLineId: (row.repair_order_line_id as string | null) ?? null,
            variantId: String(row.variant_id),
            locationId: String(row.location_id),
            openQuantity:
              num(row.reserved_quantity) - num(row.released_quantity) - num(row.fulfilled_quantity),
            allocatedQuantity: allocations.reduce(
              (sum, a) => sum + num(a.allocated_quantity) - num(a.fulfilled_quantity),
              0
            ),
            createdAt: String(row.created_at),
            sku: (variant?.sku as string | null) ?? null,
            productId: (variant?.product_id as string | null) ?? null,
            productName: (product?.name as string | null) ?? null,
            unitCode: (unit?.code as string | null) ?? null,
            locationCode: (location?.code as string | null) ?? null,
            locationName: (location?.name as string | null) ?? null,
            locationPurpose: (location?.purpose as string | null) ?? null,
            repairOrderId: (ro?.id as string | null) ?? null,
            zlNumber: (ro?.zl_number as string | null) ?? null,
            clientName: ((ro?.client_name ?? io?.client_name) as string | null) ?? null,
            partName: (rol?.product_name as string | null) ?? null,
            internalOrderId: (io?.id as string | null) ?? null,
            internalOrderNumber: (io?.order_number as string | null) ?? null,
            internalOrderDestination: (io?.destination_code as string | null) ?? null,
          };
        })
        .filter((l) => l.openQuantity > 0 || l.allocatedQuantity > 0),
    };
  }

  /**
   * Open repair-order lines of the branch that still need this item (its
   * variant, or no item yet and the same part code) -- targets for "reserve
   * for an order" and "transfer to another order". Optional ZL search.
   */
  static async findLinesNeeding(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    input: {
      variantId: string;
      sku?: string | null;
      query?: string | null;
      excludeLineId?: string | null;
    }
  ): Promise<ServiceResult<RepairOrderLineNeed[]>> {
    // Also drops , ( ) -- they would break the PostgREST or() filter below.
    const code = (input.sku ?? "").replace(/[\s\-./,()]/g, "").toUpperCase();
    let query = supabase
      .from("repair_order_lines")
      .select(
        "id, repair_order_id, product_code, product_name, variant_id, ordered_quantity, repair_orders!inner(zl_number, client_name, status, organization_id, branch_id, deleted_at)"
      )
      .is("deleted_at", null)
      .eq("repair_orders.organization_id", organizationId)
      .eq("repair_orders.branch_id", branchId)
      .eq("repair_orders.status", "open")
      .is("repair_orders.deleted_at", null)
      .limit(200);
    query = code
      ? query.or(
          `variant_id.eq.${input.variantId},and(variant_id.is.null,product_code.ilike.${code})`
        )
      : query.eq("variant_id", input.variantId);
    if (input.query?.trim())
      query = query.ilike("repair_orders.zl_number", `%${input.query.trim()}%`);
    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load repair-order lines" };

    const lines = ((data ?? []) as unknown as Array<Record<string, unknown>>).filter(
      (l) => l.id !== input.excludeLineId
    );
    const needs = await Promise.all(
      lines.map(async (l) => {
        const { data: need, error: needError } = await supabase.rpc("repair_order_line_open_need", {
          p_repair_order_line_id: l.id,
        });
        return needError ? null : num(need);
      })
    );
    // A failed lookup must not read as "needs nothing" (the line would vanish).
    if (needs.some((need) => need === null)) {
      return { success: false, error: "Failed to load repair-order needs" };
    }
    return {
      success: true,
      data: lines
        .map((l, i) => {
          const ro = one(l.repair_orders);
          return {
            repairOrderLineId: String(l.id),
            repairOrderId: String(l.repair_order_id),
            zlNumber: (ro?.zl_number as string | null) ?? null,
            clientName: (ro?.client_name as string | null) ?? null,
            productCode: (l.product_code as string | null) ?? null,
            productName: (l.product_name as string | null) ?? null,
            variantId: (l.variant_id as string | null) ?? null,
            orderedQuantity: num(l.ordered_quantity),
            openNeed: needs[i] ?? 0,
          };
        })
        .filter((l) => l.openNeed > 0)
        .sort((a, b) =>
          (a.zlNumber ?? "").localeCompare(b.zlNumber ?? "", "pl", { numeric: true })
        ),
    };
  }

  /** listHistory plus the movement document numbers and the actors' names. */
  static async listHistoryDetailed(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: { repairOrderLineIds?: string[]; reservationId?: string; limit?: number }
  ): Promise<ServiceResult<ReservationEventView[]>> {
    const base = await InventoryReservationsService.listHistory(
      supabase,
      organizationId,
      branchId,
      filter
    );
    if (!base.success) return { success: false, error: (base as { error: string }).error };
    const movementIds = [
      ...new Set(base.data.map((e) => e.movementId).filter((id): id is string => !!id)),
    ];
    const actorIds = [
      ...new Set(base.data.map((e) => e.actorUserId).filter((id): id is string => !!id)),
    ];
    const [movements, actors] = await Promise.all([
      movementIds.length
        ? supabase
            .from("inventory_movement_headers")
            .select("id, document_number")
            .in("id", movementIds)
        : Promise.resolve({ data: [], error: null }),
      actorIds.length
        ? supabase.from("users").select("id, first_name, last_name, email").in("id", actorIds)
        : Promise.resolve({ data: [] }),
    ]);
    // Document numbers are part of the trail; actor names may be hidden by RLS.
    if (movements.error) return { success: false, error: "Failed to load reservation history" };
    const numberById = new Map(
      ((movements.data ?? []) as Array<{ id: string; document_number: string | null }>).map((m) => [
        m.id,
        m.document_number,
      ])
    );
    const nameById = new Map(
      (
        (actors.data ?? []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          email: string | null;
        }>
      ).map((u) => [u.id, [u.first_name, u.last_name].filter(Boolean).join(" ") || u.email || null])
    );
    return {
      success: true,
      data: base.data.map((e) => ({
        ...e,
        movementNumber: e.movementId ? (numberById.get(e.movementId) ?? null) : null,
        actorName: e.actorUserId ? (nameById.get(e.actorUserId) ?? null) : null,
      })),
    };
  }

  /** Where an item can be reserved from: locations of the branch with D > 0 (RLS read). */
  static async listAvailableStock(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    variantIds: string[]
  ): Promise<
    ServiceResult<
      Array<{
        variantId: string;
        locationId: string;
        locationCode: string | null;
        locationName: string | null;
        available: number;
      }>
    >
  > {
    if (variantIds.length === 0) return { success: true, data: [] };
    const { data, error } = await supabase
      .from("inventory_balances")
      .select("variant_id, location_id, available_quantity, warehouse_locations(code, name)")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .in("variant_id", variantIds)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });
    if (error) return { success: false, error: "Failed to load available stock" };
    return {
      success: true,
      data: ((data ?? []) as unknown as Array<Record<string, unknown>>).map((b) => {
        const location = one(b.warehouse_locations);
        return {
          variantId: String(b.variant_id),
          locationId: String(b.location_id),
          locationCode: (location?.code as string | null) ?? null,
          locationName: (location?.name as string | null) ?? null,
          available: num(b.available_quantity),
        };
      }),
    };
  }
}
