import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  mapStockEngineError,
  type ServiceResult,
  type StockEngineError,
} from "./inventory-reservations.service";

/**
 * Blocked stock (stage E5, docs/RESERVATIONS_BLOCKS_PLAN.md): B -- parts that
 * cannot be used, for a reason. Documents BLK/rrrr/nnnnnn; B leaves the stock
 * only as 122 "Zwrot do dostawcy" (ZWD/...) or 551 "Likwidacja" (LIK/...).
 * Every write goes through an engine RPC (warehouse.inventory.operate) that
 * writes the history (inventory_stock_block_events).
 */

export const BLOCK_REASON_CODES = [
  "quality_check",
  "supplier_complaint",
  "damaged",
  "delivery_mismatch",
  "other",
] as const;
export type BlockReasonCode = (typeof BLOCK_REASON_CODES)[number];

export type BlockedStockExit = "return_to_supplier" | "scrap";

type Scope = { actorUserId: string; organizationId: string; branchId: string };

export interface BlockResult {
  blockId: string;
  blockNumber: string;
  lines: Array<{
    blockLineId: string;
    variantId: string;
    locationId: string;
    quantity: number;
    releasedReservationLineId: string | null;
  }>;
}

export interface ActiveBlockLine {
  blockLineId: string;
  blockId: string;
  blockNumber: string;
  reasonCode: BlockReasonCode;
  description: string | null;
  referenceNumber: string | null;
  variantId: string;
  locationId: string;
  openQuantity: number;
  createdAt: string;
}

export interface BlockEvent {
  id: string;
  blockId: string;
  blockLineId: string | null;
  eventType: "blocked" | "unblocked" | "moved" | "returned_to_supplier" | "scrapped";
  quantity: number;
  locationId: string | null;
  toLocationId: string | null;
  movementId: string | null;
  reservationLineId: string | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
}

const num = (v: unknown) => Number(v ?? 0);

type Row = Record<string, unknown>;
const one = (v: unknown): Row | null =>
  Array.isArray(v) ? ((v[0] as Row | undefined) ?? null) : ((v as Row | null) ?? null);

/** An active block line with what the screens show next to it. */
export interface BlockLineView extends ActiveBlockLine {
  sku: string | null;
  productId: string | null;
  productName: string | null;
  unitCode: string | null;
  locationCode: string | null;
  locationName: string | null;
  referenceType: string | null;
}

function fail<T>(error: { code?: string; message?: string }): ServiceResult<T, StockEngineError> {
  return { success: false, error: mapStockEngineError(error), message: error.message };
}

export class InventoryBlocksService {
  /**
   * Block parts (D -> B). A line naming `reservationLineId` blocks a reserved
   * part: it is taken off its reservation first (the order shows it missing).
   */
  static async block(
    supabase: SupabaseClient,
    input: Scope & {
      reasonCode: BlockReasonCode;
      description?: string | null;
      reference?: { type?: string | null; id?: string | null; number?: string | null };
      lines: Array<{
        quantity: number;
        variantId?: string | null;
        locationId?: string | null;
        reservationLineId?: string | null;
      }>;
    }
  ): Promise<ServiceResult<BlockResult, StockEngineError>> {
    const { data, error } = await supabase.rpc("inventory_block_stock", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_lines: input.lines.map((l) => ({
        quantity: l.quantity,
        variant_id: l.variantId ?? null,
        location_id: l.locationId ?? null,
        reservation_line_id: l.reservationLineId ?? null,
      })),
      p_reason_code: input.reasonCode,
      p_description: input.description ?? null,
      p_reference_type: input.reference?.type ?? null,
      p_reference_id: input.reference?.id ?? null,
      p_reference_number: input.reference?.number ?? null,
    });
    if (error) return fail(error);
    const r = (data ?? {}) as {
      block_id: string;
      block_number: string;
      lines?: Array<Record<string, unknown>>;
    };
    return {
      success: true,
      data: {
        blockId: r.block_id,
        blockNumber: r.block_number,
        lines: (r.lines ?? []).map((l) => ({
          blockLineId: String(l.block_line_id),
          variantId: String(l.variant_id),
          locationId: String(l.location_id),
          quantity: num(l.quantity),
          releasedReservationLineId: (l.released_reservation_line_id as string | null) ?? null,
        })),
      },
    };
  }

  /** B -> D, with a reason. A missing quantity unblocks what is left on the line. */
  static async unblock(
    supabase: SupabaseClient,
    input: Scope & {
      lines: Array<{ blockLineId: string; quantity?: number | null }>;
      reason: string;
    }
  ): Promise<ServiceResult<{ unblockedQuantity: number }, StockEngineError>> {
    const { data, error } = await supabase.rpc("inventory_unblock_stock", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_lines: input.lines.map((l) => ({
        block_line_id: l.blockLineId,
        quantity: l.quantity ?? null,
      })),
      p_reason: input.reason,
    });
    if (error) return fail(error);
    return {
      success: true,
      data: {
        unblockedQuantity: num((data as { unblocked_quantity?: unknown })?.unblocked_quantity),
      },
    };
  }

  /** Move a blocked part (MM); it stays blocked at the destination. */
  static async move(
    supabase: SupabaseClient,
    input: Scope & { blockLineId: string; quantity: number; destinationLocationId: string }
  ): Promise<
    ServiceResult<
      { blockLineId: string; movementId: string; documentNumber: string | null },
      StockEngineError
    >
  > {
    const { data, error } = await supabase.rpc("inventory_move_blocked_stock", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_block_line_id: input.blockLineId,
      p_quantity: input.quantity,
      p_destination_location_id: input.destinationLocationId,
    });
    if (error) return fail(error);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        blockLineId: String(r.block_line_id),
        movementId: String(r.movement_id),
        documentNumber: (r.document_number as string | null) ?? null,
      },
    };
  }

  /** Blocked parts leave the stock: return to supplier (122) or scrapping (551). */
  static async issue(
    supabase: SupabaseClient,
    input: Scope & {
      kind: BlockedStockExit;
      lines: Array<{ blockLineId: string; quantity?: number | null }>;
      reason: string;
      counterpartyName?: string | null;
    }
  ): Promise<
    ServiceResult<
      { movementId: string; documentNumber: string | null; movementTypeCode: string },
      StockEngineError
    >
  > {
    const { data, error } = await supabase.rpc("inventory_issue_blocked_stock", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_kind: input.kind,
      p_lines: input.lines.map((l) => ({
        block_line_id: l.blockLineId,
        quantity: l.quantity ?? null,
      })),
      p_reason: input.reason,
      p_counterparty_name: input.counterpartyName ?? null,
    });
    if (error) return fail(error);
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        movementId: String(r.movement_id),
        documentNumber: (r.document_number as string | null) ?? null,
        movementTypeCode: String(r.movement_type_code),
      },
    };
  }

  /** Block lines still holding stock in the branch (RLS read). */
  static async listActive(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: { variantId?: string; locationId?: string } = {}
  ): Promise<ServiceResult<ActiveBlockLine[]>> {
    let query = supabase
      .from("inventory_stock_block_lines")
      .select(
        `id, block_id, variant_id, location_id, blocked_quantity, unblocked_quantity, moved_quantity,
         consumed_quantity, created_at,
         inventory_stock_blocks!inner(block_number, reason_code, description, reference_number, status)`
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("inventory_stock_blocks.status", "active")
      .order("created_at", { ascending: true })
      .limit(1000);
    if (filter.variantId) query = query.eq("variant_id", filter.variantId);
    if (filter.locationId) query = query.eq("location_id", filter.locationId);

    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load blocked stock" };

    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return {
      success: true,
      data: rows
        .map((row) => {
          const raw = row.inventory_stock_blocks as
            | Record<string, unknown>
            | Array<Record<string, unknown>>;
          const header = (Array.isArray(raw) ? raw[0] : raw) ?? {};
          return {
            blockLineId: String(row.id),
            blockId: String(row.block_id),
            blockNumber: String(header.block_number ?? ""),
            reasonCode: header.reason_code as BlockReasonCode,
            description: (header.description as string | null) ?? null,
            referenceNumber: (header.reference_number as string | null) ?? null,
            variantId: String(row.variant_id),
            locationId: String(row.location_id),
            openQuantity:
              num(row.blocked_quantity) -
              num(row.unblocked_quantity) -
              num(row.moved_quantity) -
              num(row.consumed_quantity),
            createdAt: String(row.created_at),
          };
        })
        .filter((l) => l.openQuantity > 0),
    };
  }

  /** History of one block document. */
  static async listHistory(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    blockId: string
  ): Promise<ServiceResult<BlockEvent[]>> {
    const { data, error } = await supabase
      .from("inventory_stock_block_events")
      .select(
        "id, block_id, block_line_id, event_type, quantity, location_id, to_location_id, movement_id, reservation_line_id, reason, actor_user_id, created_at"
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("block_id", blockId)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: "Failed to load block history" };
    return {
      success: true,
      data: ((data ?? []) as Array<Record<string, unknown>>).map((e) => ({
        id: String(e.id),
        blockId: String(e.block_id),
        blockLineId: (e.block_line_id as string | null) ?? null,
        eventType: e.event_type as BlockEvent["eventType"],
        quantity: num(e.quantity),
        locationId: (e.location_id as string | null) ?? null,
        toLocationId: (e.to_location_id as string | null) ?? null,
        movementId: (e.movement_id as string | null) ?? null,
        reservationLineId: (e.reservation_line_id as string | null) ?? null,
        reason: (e.reason as string | null) ?? null,
        actorUserId: (e.actor_user_id as string | null) ?? null,
        createdAt: String(e.created_at),
      })),
    };
  }

  /** Active blocked stock of the branch with part and location (RLS read). */
  static async listActiveDetailed(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: { variantIds?: string[] } = {}
  ): Promise<ServiceResult<BlockLineView[]>> {
    let query = supabase
      .from("inventory_stock_block_lines")
      .select(
        `id, block_id, variant_id, location_id, blocked_quantity, unblocked_quantity, moved_quantity,
         consumed_quantity, created_at,
         inventory_stock_blocks!inner(block_number, reason_code, description, reference_type, reference_number, status),
         inventory_variants(sku, product_id, inventory_products(name, inventory_units(code))),
         warehouse_locations(code, name)`
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("inventory_stock_blocks.status", "active")
      .order("created_at", { ascending: true })
      .limit(2000);
    if (filter.variantIds?.length) query = query.in("variant_id", filter.variantIds);
    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load blocked stock" };

    return {
      success: true,
      data: ((data ?? []) as unknown as Array<Record<string, unknown>>)
        .map((row) => {
          const header = one(row.inventory_stock_blocks) ?? {};
          const variant = one(row.inventory_variants);
          const product = one(variant?.inventory_products);
          const unit = one(product?.inventory_units);
          const location = one(row.warehouse_locations);
          return {
            blockLineId: String(row.id),
            blockId: String(row.block_id),
            blockNumber: String(header.block_number ?? ""),
            reasonCode: header.reason_code as BlockReasonCode,
            description: (header.description as string | null) ?? null,
            referenceType: (header.reference_type as string | null) ?? null,
            referenceNumber: (header.reference_number as string | null) ?? null,
            variantId: String(row.variant_id),
            locationId: String(row.location_id),
            openQuantity:
              num(row.blocked_quantity) -
              num(row.unblocked_quantity) -
              num(row.moved_quantity) -
              num(row.consumed_quantity),
            createdAt: String(row.created_at),
            sku: (variant?.sku as string | null) ?? null,
            productId: (variant?.product_id as string | null) ?? null,
            productName: (product?.name as string | null) ?? null,
            unitCode: (unit?.code as string | null) ?? null,
            locationCode: (location?.code as string | null) ?? null,
            locationName: (location?.name as string | null) ?? null,
          };
        })
        .filter((l) => l.openQuantity > 0),
    };
  }
}
