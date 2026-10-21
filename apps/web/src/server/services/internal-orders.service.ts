import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Internal orders (ZW, docs/INTERNAL_ORDERS_PLAN.md): Ambra's own ZW
 * documents, one per AutoStacja ZW, linking parts to a repair order or
 * standing alone (an order from another branch). Lines are never
 * overwritten; received / reserved / issued are computed from the receipt
 * rows and the reservation lines (view internal_order_line_status).
 */

export type InternalOrderClientKind = "repair_order" | "branch" | "other";
export type InternalOrderStatus = "open" | "completed" | "cancelled";

export interface InternalOrderLineView {
  id: string;
  lineNumber: number;
  productCode: string | null;
  productName: string;
  variantId: string | null;
  quantity: number;
  /** Ordered in Ambra (status Z); false for lines known from a delivery. */
  ordered: boolean;
  repairOrderLineId: string | null;
  source: "matcher" | "manual";
  cancelledAt: string | null;
  cancelReason: string | null;
  createdAt: string;
  receivedQuantity: number;
  reservedQuantity: number;
  issuedQuantity: number;
}

export interface InternalOrderReceipt {
  internalOrderLineId: string;
  movementId: string;
  documentNumber: string | null;
  postedAt: string | null;
  quantity: number;
}

export interface InternalOrderView {
  id: string;
  number: string;
  externalNumber: string | null;
  externalZlNumber: string | null;
  warehouseCode: string;
  repairOrderId: string | null;
  repairOrderZl: string | null;
  clientKind: InternalOrderClientKind;
  clientName: string | null;
  destinationCode: string | null;
  status: InternalOrderStatus;
  source: "matcher" | "manual";
  notes: string | null;
  createdAt: string;
  lines: InternalOrderLineView[];
  receipts: InternalOrderReceipt[];
}

export interface InternalOrderListFilter {
  repairOrderId?: string;
  /** "repair_order": under a repair order; "standalone": without one (e.g. another branch). */
  kind?: "repair_order" | "standalone";
  status?: InternalOrderStatus;
  search?: string;
  limit?: number;
}

const ORDER_COLUMNS =
  "id, order_number, external_number, external_zl_number, warehouse_code, repair_order_id, client_kind, client_name, destination_code, status, source, notes, created_at, repair_orders(zl_number)";
const LINE_COLUMNS =
  "id, internal_order_id, line_number, product_code, product_name, variant_id, quantity, ordered, repair_order_line_id, source, cancelled_at, cancel_reason, created_at";

type OrderRow = {
  id: string;
  order_number: string;
  external_number: string | null;
  external_zl_number: string | null;
  warehouse_code: string;
  repair_order_id: string | null;
  client_kind: InternalOrderClientKind;
  client_name: string | null;
  destination_code: string | null;
  status: InternalOrderStatus;
  source: "matcher" | "manual";
  notes: string | null;
  created_at: string;
  repair_orders: { zl_number: string | null } | Array<{ zl_number: string | null }> | null;
};

type LineRow = {
  id: string;
  internal_order_id: string;
  line_number: number;
  product_code: string | null;
  product_name: string;
  variant_id: string | null;
  quantity: number | string;
  ordered: boolean;
  repair_order_line_id: string | null;
  source: "matcher" | "manual";
  cancelled_at: string | null;
  cancel_reason: string | null;
  created_at: string;
};

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export class InternalOrdersService {
  static async list(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    filter: InternalOrderListFilter = {}
  ): Promise<ServiceResult<InternalOrderView[]>> {
    let query = supabase
      .from("internal_orders")
      .select(ORDER_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: false })
      .limit(filter.limit ?? 200);
    if (filter.repairOrderId) query = query.eq("repair_order_id", filter.repairOrderId);
    if (filter.kind === "repair_order") query = query.not("repair_order_id", "is", null);
    if (filter.kind === "standalone") query = query.is("repair_order_id", null);
    if (filter.status) query = query.eq("status", filter.status);
    const search = filter.search?.trim().replace(/[%,()]/g, "");
    if (search) {
      query = query.or(
        `order_number.ilike.%${search}%,external_number.ilike.%${search}%,client_name.ilike.%${search}%,destination_code.ilike.%${search}%,external_zl_number.ilike.%${search}%`
      );
    }
    const { data, error } = await query;
    if (error) return { success: false, error: "Failed to load internal orders" };
    return InternalOrdersService.withLines(supabase, (data ?? []) as unknown as OrderRow[]);
  }

  static async get(
    supabase: SupabaseClient,
    organizationId: string,
    id: string
  ): Promise<ServiceResult<InternalOrderView | null>> {
    const { data, error } = await supabase
      .from("internal_orders")
      .select(ORDER_COLUMNS)
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();
    if (error) return { success: false, error: "Failed to load the internal order" };
    if (!data) return { success: true, data: null };
    const result = await InternalOrdersService.withLines(supabase, [data as unknown as OrderRow]);
    // Narrowed by hand: this tsconfig does not narrow the result union.
    if (!result.success) return { success: false, error: (result as { error: string }).error };
    return { success: true, data: (result as { data: InternalOrderView[] }).data[0] ?? null };
  }

  private static async withLines(
    supabase: SupabaseClient,
    orders: OrderRow[]
  ): Promise<ServiceResult<InternalOrderView[]>> {
    if (orders.length === 0) return { success: true, data: [] };
    const orderIds = orders.map((o) => o.id);

    const [linesResult, statusResult] = await Promise.all([
      supabase
        .from("internal_order_lines")
        .select(LINE_COLUMNS)
        .in("internal_order_id", orderIds)
        .order("line_number", { ascending: true }),
      supabase
        .from("internal_order_line_status")
        .select("internal_order_line_id, received_quantity, reserved_quantity, issued_quantity")
        .in("internal_order_id", orderIds),
    ]);
    // A failed read must not look like an order with nothing received.
    if (linesResult.error || statusResult.error) {
      return { success: false, error: "Failed to load internal order lines" };
    }
    const lines = (linesResult.data ?? []) as LineRow[];
    const statusById = new Map(
      (
        (statusResult.data ?? []) as Array<{
          internal_order_line_id: string;
          received_quantity: number | string;
          reserved_quantity: number | string;
          issued_quantity: number | string;
        }>
      ).map((s) => [s.internal_order_line_id, s])
    );

    const lineIds = lines.map((l) => l.id);
    const { data: linkRows, error: linksError } = lineIds.length
      ? await supabase
          .from("internal_order_line_movement_links")
          .select(
            "internal_order_line_id, applied_quantity, inventory_movement_lines!inner(movement_id, inventory_movement_headers!inner(document_number, posted_at))"
          )
          .in("internal_order_line_id", lineIds)
          .eq("relation_type", "receipt")
      : { data: [], error: null };
    if (linksError) return { success: false, error: "Failed to load internal order receipts" };
    type LinkRow = {
      internal_order_line_id: string;
      applied_quantity: number | string;
      inventory_movement_lines:
        | {
            movement_id: string;
            inventory_movement_headers:
              | { document_number: string | null; posted_at: string | null }
              | Array<{ document_number: string | null; posted_at: string | null }>;
          }
        | Array<{
            movement_id: string;
            inventory_movement_headers:
              | { document_number: string | null; posted_at: string | null }
              | Array<{ document_number: string | null; posted_at: string | null }>;
          }>;
    };
    const receiptsByLine = new Map<string, InternalOrderReceipt[]>();
    for (const link of (linkRows ?? []) as unknown as LinkRow[]) {
      const ml = one(link.inventory_movement_lines);
      if (!ml) continue;
      const header = one(ml.inventory_movement_headers);
      const list = receiptsByLine.get(link.internal_order_line_id) ?? [];
      list.push({
        internalOrderLineId: link.internal_order_line_id,
        movementId: ml.movement_id,
        documentNumber: header?.document_number ?? null,
        postedAt: header?.posted_at ?? null,
        quantity: Number(link.applied_quantity),
      });
      receiptsByLine.set(link.internal_order_line_id, list);
    }

    const linesByOrder = new Map<string, InternalOrderLineView[]>();
    for (const l of lines) {
      const s = statusById.get(l.id);
      const list = linesByOrder.get(l.internal_order_id) ?? [];
      list.push({
        id: l.id,
        lineNumber: l.line_number,
        productCode: l.product_code,
        productName: l.product_name,
        variantId: l.variant_id,
        quantity: Number(l.quantity),
        ordered: l.ordered,
        repairOrderLineId: l.repair_order_line_id,
        source: l.source,
        cancelledAt: l.cancelled_at,
        cancelReason: l.cancel_reason,
        createdAt: l.created_at,
        receivedQuantity: Number(s?.received_quantity ?? 0),
        reservedQuantity: Number(s?.reserved_quantity ?? 0),
        issuedQuantity: Number(s?.issued_quantity ?? 0),
      });
      linesByOrder.set(l.internal_order_id, list);
    }

    return {
      success: true,
      data: orders.map((o) => {
        const orderLines = linesByOrder.get(o.id) ?? [];
        return {
          id: o.id,
          number: o.order_number,
          externalNumber: o.external_number,
          externalZlNumber: o.external_zl_number,
          warehouseCode: o.warehouse_code,
          repairOrderId: o.repair_order_id,
          repairOrderZl: one(o.repair_orders)?.zl_number ?? o.external_zl_number,
          clientKind: o.client_kind,
          clientName: o.client_name,
          destinationCode: o.destination_code,
          status: o.status,
          source: o.source,
          notes: o.notes,
          createdAt: o.created_at,
          lines: orderLines,
          receipts: orderLines
            .flatMap((l) => receiptsByLine.get(l.id) ?? [])
            .sort((a, b) => (a.postedAt ?? "").localeCompare(b.postedAt ?? "")),
        };
      }),
    };
  }
}

// ─── Operations (E3 / E4) ──────────────────────────────────────────────────────

/** Stable error codes of the ZW operations; the UI owns the wording. */
export type InternalOrderError =
  | "unauthorized"
  | "not_found"
  | "duplicate_number"
  | "number_already_set"
  | "not_enough"
  | "insufficient_stock"
  | "no_warehouse_code"
  | "no_destination"
  | "nothing_to_ship"
  | "in_container"
  | "not_open"
  | "reason_required"
  | "code_taken"
  | "invalid"
  | "unexpected";

export function mapInternalOrderError(error: {
  code?: string;
  message?: string;
}): InternalOrderError {
  const m = error.message ?? "";
  if (error.code === "28000" || error.code === "42501") return "unauthorized";
  if (/already belongs to another branch/i.test(m)) return "code_taken";
  if (/AutoStacja number is already set/i.test(m)) return "number_already_set";
  if (/already exists/i.test(m)) return "duplicate_number";
  if (/still needed|more than ordered/i.test(m)) return "not_enough";
  if (/Insufficient available stock/i.test(m)) return "insufficient_stock";
  if (/warehouse code/i.test(m)) return "no_warehouse_code";
  if (/No branch has this|another branch of the organization/i.test(m)) return "no_destination";
  if (/Nothing of this ZW/i.test(m)) return "nothing_to_ship";
  if (/container/i.test(m)) return "in_container";
  if (/not open|already cancelled|is cancelled/i.test(m)) return "not_open";
  if (/reason is required/i.test(m)) return "reason_required";
  if (error.code === "P0002") return "not_found";
  if (error.code === "22023") return "invalid";
  return "unexpected";
}

type OpResult<T> = { success: true; data: T } | { success: false; error: InternalOrderError };

function rpcResult<T>(
  data: unknown,
  error: { code?: string; message?: string } | null,
  map: (raw: Record<string, unknown>) => T
): OpResult<T> {
  if (error) return { success: false, error: mapInternalOrderError(error) };
  return { success: true, data: map((data ?? {}) as Record<string, unknown>) };
}

export interface InternalOrderCreateLine {
  repairOrderLineId?: string | null;
  variantId?: string | null;
  productCode?: string | null;
  productName?: string | null;
  quantity: number;
  reserve?: Array<{ locationId: string; quantity: number }>;
}

export interface BranchWithCodes {
  id: string;
  name: string;
  externalCodes: string[];
}

export interface BranchTransferView {
  id: string;
  number: string;
  status: string;
  sourceBranchId: string;
  sourceBranchName: string | null;
  destinationBranchId: string;
  destinationBranchName: string | null;
  internalOrderId: string | null;
  internalOrderNumber: string | null;
  notes: string | null;
  createdAt: string;
  lines: Array<{ id: string; sku: string | null; productName: string | null; quantity: number }>;
}

export interface StockElsewhere {
  branchId: string;
  branchName: string;
  variantId: string;
  locationId: string;
  locationCode: string | null;
  locationName: string | null;
  available: number;
}

export class InternalOrderOperationsService {
  static async create(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      organizationId: string;
      branchId: string;
      repairOrderId: string | null;
      externalNumber: string | null;
      clientName: string | null;
      destinationCode: string | null;
      notes: string | null;
      /** The unit the ZW is numbered in (e.g. 3142); default: the repair order's / the branch's. */
      warehouseCode?: string | null;
      lines: InternalOrderCreateLine[];
    }
  ): Promise<OpResult<{ id: string; number: string; reservationNumber: string | null }>> {
    const { data, error } = await supabase.rpc("internal_order_open", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_repair_order_id: input.repairOrderId,
      p_external_number: input.externalNumber,
      p_client_name: input.clientName,
      p_destination_code: input.destinationCode,
      p_lines: input.lines.map((l) => ({
        repair_order_line_id: l.repairOrderLineId ?? null,
        variant_id: l.variantId ?? null,
        product_code: l.productCode ?? null,
        product_name: l.productName ?? null,
        quantity: l.quantity,
        reserve: (l.reserve ?? []).map((r) => ({
          location_id: r.locationId,
          quantity: r.quantity,
        })),
      })),
      p_notes: input.notes,
      p_warehouse_code: input.warehouseCode ?? null,
    });
    return rpcResult(data, error, (r) => ({
      id: String(r.internal_order_id),
      number: String(r.order_number),
      reservationNumber: (r.reservation_number as string | null) ?? null,
    }));
  }

  static async reserveFromStock(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      internalOrderId: string;
      lines: Array<{ internalOrderLineId: string; locationId: string; quantity: number }>;
    }
  ): Promise<OpResult<{ reservationNumber: string | null }>> {
    const { data, error } = await supabase.rpc("internal_order_reserve_from_stock", {
      p_actor_user_id: input.actorUserId,
      p_internal_order_id: input.internalOrderId,
      p_lines: input.lines.map((l) => ({
        internal_order_line_id: l.internalOrderLineId,
        location_id: l.locationId,
        quantity: l.quantity,
      })),
    });
    return rpcResult(data, error, (r) => ({
      reservationNumber: (r.reservation_number as string | null) ?? null,
    }));
  }

  static async cancelLine(
    supabase: SupabaseClient,
    input: { actorUserId: string; internalOrderLineId: string; reason: string }
  ): Promise<OpResult<{ releasedQuantity: number }>> {
    const { data, error } = await supabase.rpc("internal_order_cancel_line", {
      p_actor_user_id: input.actorUserId,
      p_internal_order_line_id: input.internalOrderLineId,
      p_reason: input.reason,
    });
    return rpcResult(data, error, (r) => ({ releasedQuantity: Number(r.released_quantity ?? 0) }));
  }

  static async setExternalNumber(
    supabase: SupabaseClient,
    input: { actorUserId: string; internalOrderId: string; externalNumber: string }
  ): Promise<OpResult<{ externalNumber: string }>> {
    const { data, error } = await supabase.rpc("internal_order_set_external_number", {
      p_actor_user_id: input.actorUserId,
      p_internal_order_id: input.internalOrderId,
      p_external_number: input.externalNumber,
    });
    return rpcResult(data, error, (r) => ({ externalNumber: String(r.external_number) }));
  }

  static async ship(
    supabase: SupabaseClient,
    input: { actorUserId: string; internalOrderId: string; destinationBranchId: string | null }
  ): Promise<
    OpResult<{ documentNumber: string | null; transferNumber: string; branchName: string }>
  > {
    const { data, error } = await supabase.rpc("internal_order_ship", {
      p_actor_user_id: input.actorUserId,
      p_internal_order_id: input.internalOrderId,
      p_destination_branch_id: input.destinationBranchId,
    });
    return rpcResult(data, error, (r) => ({
      documentNumber: (r.document_number as string | null) ?? null,
      transferNumber: String(r.transfer_number),
      branchName: String(r.destination_branch_name ?? ""),
    }));
  }

  static async requestFromBranch(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      internalOrderId: string;
      sourceBranchId: string;
      lines: Array<{ internalOrderLineId: string; locationId: string; quantity: number }>;
    }
  ): Promise<OpResult<{ transferNumber: string }>> {
    const { data, error } = await supabase.rpc("internal_order_request_from_branch", {
      p_actor_user_id: input.actorUserId,
      p_internal_order_id: input.internalOrderId,
      p_source_branch_id: input.sourceBranchId,
      p_lines: input.lines.map((l) => ({
        internal_order_line_id: l.internalOrderLineId,
        location_id: l.locationId,
        quantity: l.quantity,
      })),
    });
    return rpcResult(data, error, (r) => ({ transferNumber: String(r.transfer_number) }));
  }

  static async sendTransfer(
    supabase: SupabaseClient,
    input: { actorUserId: string; transferId: string }
  ): Promise<OpResult<{ documentNumber: string | null }>> {
    const { data, error } = await supabase.rpc("inventory_send_branch_transfer", {
      p_transfer_id: input.transferId,
      p_actor_user_id: input.actorUserId,
    });
    return rpcResult(data, error, (r) => ({
      documentNumber: (r.source_document_number as string | null) ?? null,
    }));
  }

  static async acceptTransfer(
    supabase: SupabaseClient,
    input: { actorUserId: string; transferId: string }
  ): Promise<OpResult<{ reservationNumber: string | null }>> {
    const { data, error } = await supabase.rpc("internal_order_accept_transfer", {
      p_actor_user_id: input.actorUserId,
      p_transfer_id: input.transferId,
    });
    return rpcResult(data, error, (r) => ({
      reservationNumber: (r.reservation_number as string | null) ?? null,
    }));
  }

  static async stockElsewhere(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    variantIds: string[]
  ): Promise<ServiceResult<StockElsewhere[]>> {
    if (variantIds.length === 0) return { success: true, data: [] };
    const { data, error } = await supabase.rpc("internal_order_stock_elsewhere", {
      p_organization_id: organizationId,
      p_branch_id: branchId,
      p_variant_ids: variantIds,
    });
    if (error) return { success: false, error: "Failed to load stock of other branches" };
    return {
      success: true,
      data: ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
        branchId: String(r.branch_id),
        branchName: String(r.branch_name ?? ""),
        variantId: String(r.variant_id),
        locationId: String(r.location_id),
        locationCode: (r.location_code as string | null) ?? null,
        locationName: (r.location_name as string | null) ?? null,
        available: Number(r.available ?? 0),
      })),
    };
  }

  static async listBranches(
    supabase: SupabaseClient,
    organizationId: string
  ): Promise<ServiceResult<BranchWithCodes[]>> {
    const { data, error } = await supabase
      .from("branches")
      .select("id, name, external_codes")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("name");
    if (error) return { success: false, error: "Failed to load branches" };
    return {
      success: true,
      data: (
        (data ?? []) as Array<{ id: string; name: string; external_codes: string[] | null }>
      ).map((b) => ({ id: b.id, name: b.name, externalCodes: b.external_codes ?? [] })),
    };
  }

  static async setBranchCodes(
    supabase: SupabaseClient,
    input: { actorUserId: string; organizationId: string; branchId: string; codes: string[] }
  ): Promise<OpResult<{ codes: string[] }>> {
    const { data, error } = await supabase.rpc("branch_set_external_codes", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_codes: input.codes,
    });
    return rpcResult(data, error, (r) => ({ codes: (r.external_codes as string[]) ?? [] }));
  }

  /**
   * Transfers to act on in this branch: arriving (in transit to it) and to
   * send (prepared here, e.g. reserved by another branch for its ZW).
   */
  static async listTransfers(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string
  ): Promise<ServiceResult<{ incoming: BranchTransferView[]; toSend: BranchTransferView[] }>> {
    const { data, error } = await supabase
      .from("inventory_branch_transfers")
      .select(
        "id, transfer_number, status, source_branch_id, destination_branch_id, internal_order_id, notes, created_at, internal_orders(order_number), inventory_branch_transfer_lines(id, quantity, inventory_variants(sku, inventory_products(name)))"
      )
      .eq("organization_id", organizationId)
      .or(
        `and(destination_branch_id.eq.${branchId},status.eq.in_transit),and(source_branch_id.eq.${branchId},status.eq.prepared)`
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { success: false, error: "Failed to load branch transfers" };
    const branches = await InternalOrderOperationsService.listBranches(supabase, organizationId);
    const names = new Map((branches.success ? branches.data : []).map((b) => [b.id, b.name]));
    type Row = {
      id: string;
      transfer_number: string;
      status: string;
      source_branch_id: string;
      destination_branch_id: string;
      internal_order_id: string | null;
      notes: string | null;
      created_at: string;
      internal_orders: { order_number: string } | Array<{ order_number: string }> | null;
      inventory_branch_transfer_lines: Array<{
        id: string;
        quantity: number | string;
        inventory_variants: {
          sku: string | null;
          inventory_products: { name: string } | Array<{ name: string }> | null;
        } | null;
      }>;
    };
    const views = ((data ?? []) as unknown as Row[]).map((t) => ({
      id: t.id,
      number: t.transfer_number,
      status: t.status,
      sourceBranchId: t.source_branch_id,
      sourceBranchName: names.get(t.source_branch_id) ?? null,
      destinationBranchId: t.destination_branch_id,
      destinationBranchName: names.get(t.destination_branch_id) ?? null,
      internalOrderId: t.internal_order_id,
      internalOrderNumber: one(t.internal_orders)?.order_number ?? null,
      notes: t.notes,
      createdAt: t.created_at,
      lines: (t.inventory_branch_transfer_lines ?? []).map((l) => ({
        id: l.id,
        sku: one(l.inventory_variants)?.sku ?? null,
        productName: one(one(l.inventory_variants)?.inventory_products)?.name ?? null,
        quantity: Number(l.quantity),
      })),
    }));
    return {
      success: true,
      data: {
        incoming: views.filter(
          (v) => v.destinationBranchId === branchId && v.status === "in_transit"
        ),
        toSend: views.filter((v) => v.sourceBranchId === branchId && v.status === "prepared"),
      },
    };
  }
}
