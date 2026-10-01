import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Zone 5 (2026-10-01 product decisions): the receiving zone is a waiting
 * room. A PZ always lands in the branch's receiving location; what sits
 * there is not available until it is put away. Putaway is its own function:
 * a RepairOrder part goes into that RepairOrder's container at the scanned
 * location, bulk material to its fixed bin (reserved for the line), free
 * stock loose. All rules live in the RPCs; this service maps them.
 */

export type ProductHandlingMode = "standard" | "bulk";

export interface ReceivingPendingItem {
  variantId: string;
  productId: string;
  sku: string | null;
  productName: string | null;
  unitId: string | null;
  unitCode: string | null;
  quantity: number;
  documentNumber: string | null;
  repairOrderLineId: string | null;
  repairOrderId: string | null;
  zlNumber: string | null;
  vehicleBrand: string | null;
  handlingMode: ProductHandlingMode;
  defaultLocation: { id: string; code: string | null; name: string | null } | null;
  container: {
    id: string;
    code: string;
    locationId: string | null;
    locationCode: string | null;
    locationName: string | null;
  } | null;
}

export interface ReceivingPending {
  receivingLocationId: string | null;
  items: ReceivingPendingItem[];
}

export interface PutawayResult {
  mode: "free" | "bulk" | "container";
  movementId: string | null;
  documentNumber: string | null;
  destinationLocationId: string;
  quantity: number;
  reservedQuantity: number;
  zlNumber: string | null;
  containerId: string | null;
  containerCode: string | null;
  containerCreated: boolean;
}

/** Stable putaway error codes; the UI owns the wording. */
export type PutawayError =
  | "unauthorized"
  | "not_found"
  | "invalid_destination"
  | "not_enough"
  | "wrong_item"
  | "no_receiving_location"
  | "unexpected";

export interface ProductBranchSettings {
  productId: string;
  handlingMode: ProductHandlingMode;
  defaultLocationId: string | null;
}

export interface ReceiptReportPutaway {
  locationCode: string | null;
  locationName: string | null;
  quantity: number;
  documentNumber: string | null;
}

export interface ReceiptReportLine {
  lineNumber: number;
  sku: string;
  productName: string;
  quantity: number;
  unitCode: string;
  zlNumber: string | null;
  putaway: ReceiptReportPutaway[];
  containers: Array<{ code: string; locationCode: string | null; locationName: string | null }>;
  pendingQuantity: number;
}

export interface ReceiptReportInput {
  movementId: string;
  postedAt: string | null;
  lines: Array<{
    id: string;
    line_number: number;
    variant_id: string;
    sku: string;
    product_name: string;
    quantity: number;
    unit_code: string;
  }>;
}

export interface ReceiptAttributionLine {
  movementLineId: string;
  sourceLineId: string;
}

function mapPutawayError(error: { code?: string; message: string }): PutawayError {
  const message = error.message ?? "";
  if (error.code === "28000" || error.code === "42501") return "unauthorized";
  if (/No active receiving location/i.test(message)) return "no_receiving_location";
  if (/Destination|receiving location itself/i.test(message)) return "invalid_destination";
  if (/does not match|variant/i.test(message)) return "wrong_item";
  if (/Not enough|only .* is currently attributed|must be positive/i.test(message)) {
    return "not_enough";
  }
  if (error.code === "P0002") return "not_found";
  return "unexpected";
}

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export class InventoryReceivingService {
  static async listPending(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string
  ): Promise<ServiceResult<ReceivingPending>> {
    const { data, error } = await supabase.rpc("inventory_receiving_pending", {
      p_organization_id: organizationId,
      p_branch_id: branchId,
    });
    if (error) return { success: false, error: "Failed to load the receiving zone" };

    const raw = (data ?? {}) as { receiving_location_id?: string | null; items?: unknown[] };
    const items = (raw.items ?? []).map((value) => {
      const it = value as Record<string, unknown>;
      return {
        variantId: String(it.variant_id),
        productId: String(it.product_id),
        sku: str(it.sku),
        productName: str(it.product_name),
        unitId: str(it.unit_id),
        unitCode: str(it.unit_code),
        quantity: num(it.quantity),
        documentNumber: str(it.document_number),
        repairOrderLineId: str(it.repair_order_line_id),
        repairOrderId: str(it.repair_order_id),
        zlNumber: str(it.zl_number),
        vehicleBrand: str(it.vehicle_brand),
        handlingMode: it.handling_mode === "bulk" ? "bulk" : "standard",
        defaultLocation: str(it.default_location_id)
          ? {
              id: String(it.default_location_id),
              code: str(it.default_location_code),
              name: str(it.default_location_name),
            }
          : null,
        container: str(it.container_id)
          ? {
              id: String(it.container_id),
              code: String(it.container_code),
              locationId: str(it.container_location_id),
              locationCode: str(it.container_location_code),
              locationName: str(it.container_location_name),
            }
          : null,
      } satisfies ReceivingPendingItem;
    });

    return {
      success: true,
      data: { receivingLocationId: raw.receiving_location_id ?? null, items },
    };
  }

  static async putaway(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      organizationId: string;
      branchId: string;
      variantId: string;
      quantity: number;
      destinationLocationId: string;
      repairOrderLineId: string | null;
      containerId?: string | null;
    }
  ): Promise<ServiceResult<PutawayResult>> {
    const { data, error } = await supabase.rpc("inventory_putaway_from_receiving", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_variant_id: input.variantId,
      p_quantity: input.quantity,
      p_destination_location_id: input.destinationLocationId,
      p_repair_order_line_id: input.repairOrderLineId,
      p_container_id: input.containerId ?? null,
    });
    if (error) return { success: false, error: mapPutawayError(error) };

    const r = (data ?? {}) as Record<string, unknown>;
    const mode = r.mode === "bulk" || r.mode === "container" ? r.mode : "free";
    return {
      success: true,
      data: {
        mode,
        movementId: str(r.movement_id),
        documentNumber: str(r.document_number),
        destinationLocationId: String(r.destination_location_id ?? input.destinationLocationId),
        quantity: num(r.quantity ?? input.quantity),
        reservedQuantity: num(r.reserved_quantity),
        zlNumber: str(r.zl_number),
        containerId: str(r.container_id),
        containerCode: str(r.container_code),
        containerCreated: r.container_created === true,
      },
    };
  }

  /**
   * After a PZ is posted: link its lines to RepairOrderLines through their
   * Matcher source lines. Unresolvable lines are skipped by the RPC (the PZ
   * stands; they show up as free stock in the receiving zone).
   */
  static async attributeReceipt(
    supabase: SupabaseClient,
    actorUserId: string,
    movementId: string,
    lines: ReceiptAttributionLine[]
  ): Promise<ServiceResult<{ attributed: number; skipped: number }>> {
    if (lines.length === 0) return { success: true, data: { attributed: 0, skipped: 0 } };
    const { data, error } = await supabase.rpc("inventory_attribute_receipt_lines", {
      p_actor_user_id: actorUserId,
      p_movement_id: movementId,
      p_lines: lines.map((l) => ({
        movement_line_id: l.movementLineId,
        source_line_id: l.sourceLineId,
      })),
    });
    if (error) return { success: false, error: "Failed to link the receipt to repair orders" };
    const r = (data ?? {}) as { attributed?: unknown[]; skipped?: unknown[] };
    return {
      success: true,
      data: { attributed: r.attributed?.length ?? 0, skipped: r.skipped?.length ?? 0 },
    };
  }

  /** The branch's receiving location id, or null when none is configured. */
  static async getReceivingLocationId(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string
  ): Promise<string | null> {
    const { data } = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("purpose", "receiving")
      .eq("can_store_inventory", true)
      .is("deleted_at", null)
      .maybeSingle();
    return (data as { id: string } | null)?.id ?? null;
  }

  static async getProductSettings(
    supabase: SupabaseClient,
    branchId: string,
    productId: string
  ): Promise<ServiceResult<ProductBranchSettings>> {
    const { data, error } = await supabase
      .from("inventory_product_branch_settings")
      .select("product_id, handling_mode, default_location_id")
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .maybeSingle();
    if (error) return { success: false, error: "Failed to load product handling" };
    const row = data as {
      product_id: string;
      handling_mode: string;
      default_location_id: string | null;
    } | null;
    return {
      success: true,
      data: {
        productId,
        handlingMode: row?.handling_mode === "bulk" ? "bulk" : "standard",
        defaultLocationId: row?.default_location_id ?? null,
      },
    };
  }

  static async saveProductSettings(
    supabase: SupabaseClient,
    input: {
      organizationId: string;
      branchId: string;
      productId: string;
      handlingMode: ProductHandlingMode;
      defaultLocationId: string | null;
      actorUserId: string;
    }
  ): Promise<ServiceResult<ProductBranchSettings>> {
    const { error } = await supabase.from("inventory_product_branch_settings").upsert(
      {
        organization_id: input.organizationId,
        branch_id: input.branchId,
        product_id: input.productId,
        handling_mode: input.handlingMode,
        default_location_id: input.defaultLocationId,
        created_by: input.actorUserId,
        updated_by: input.actorUserId,
      },
      { onConflict: "branch_id,product_id" }
    );
    if (error) return { success: false, error: "Failed to save product handling" };
    return {
      success: true,
      data: {
        productId: input.productId,
        handlingMode: input.handlingMode,
        defaultLocationId: input.defaultLocationId,
      },
    };
  }

  /**
   * Zone 5 report for DMS/AutoStacja: for each PZ line -- its ZL, where it
   * was put away (location, document, RO container) and what still waits in
   * the receiving zone. RepairOrder lines are traced exactly through their
   * receipt/relocation links; free lines through the 801s out of the
   * receiving zone for that item since the PZ was posted (approximate when
   * several PZs bring the same item). RepairOrder details need
   * workshop.repair_orders.read (RLS) and are simply absent otherwise.
   */
  static async getReceiptReport(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    input: ReceiptReportInput
  ): Promise<ServiceResult<ReceiptReportLine[]>> {
    const receiving = await InventoryReceivingService.getReceivingLocationId(
      supabase,
      organizationId,
      branchId
    );
    const pending = await InventoryReceivingService.listPending(supabase, organizationId, branchId);
    const pendingItems = pending.success ? pending.data.items : [];
    const lineIds = input.lines.map((l) => l.id);
    if (lineIds.length === 0) return { success: true, data: [] };

    const { data: receiptLinks } = await supabase
      .from("repair_order_line_movement_links")
      .select("repair_order_line_id, inventory_movement_line_id")
      .in("inventory_movement_line_id", lineIds)
      .eq("relation_type", "receipt");
    const rolByLine = new Map<string, string>();
    for (const link of (receiptLinks ?? []) as Array<{
      repair_order_line_id: string;
      inventory_movement_line_id: string;
    }>) {
      rolByLine.set(link.inventory_movement_line_id, link.repair_order_line_id);
    }
    const rolIds = [...new Set(rolByLine.values())];

    const roByRol = new Map<string, string>();
    const zlByRo = new Map<string, string | null>();
    const putawayByRol = new Map<string, Array<{ lineId: string; quantity: number }>>();
    if (rolIds.length > 0) {
      const [{ data: rols }, { data: relocations }] = await Promise.all([
        supabase.from("repair_order_lines").select("id, repair_order_id").in("id", rolIds),
        supabase
          .from("repair_order_line_movement_links")
          .select("repair_order_line_id, inventory_movement_line_id, applied_quantity")
          .in("repair_order_line_id", rolIds)
          .eq("relation_type", "relocation"),
      ]);
      for (const r of (rols ?? []) as Array<{ id: string; repair_order_id: string }>) {
        roByRol.set(r.id, r.repair_order_id);
      }
      for (const r of (relocations ?? []) as Array<{
        repair_order_line_id: string;
        inventory_movement_line_id: string;
        applied_quantity: number;
      }>) {
        const list = putawayByRol.get(r.repair_order_line_id) ?? [];
        list.push({ lineId: r.inventory_movement_line_id, quantity: Number(r.applied_quantity) });
        putawayByRol.set(r.repair_order_line_id, list);
      }
      const roIds = [...new Set(roByRol.values())];
      if (roIds.length > 0) {
        const { data: ros } = await supabase
          .from("repair_orders")
          .select("id, zl_number")
          .in("id", roIds);
        for (const ro of (ros ?? []) as Array<{ id: string; zl_number: string | null }>) {
          zlByRo.set(ro.id, ro.zl_number);
        }
      }
    }

    // Movement lines that took stock out of the receiving zone: the RO
    // relocation lines plus, for free items, 801s since the PZ was posted.
    const relocationLineIds = [...putawayByRol.values()].flat().map((r) => r.lineId);
    const freeVariantIds = [
      ...new Set(input.lines.filter((l) => !rolByLine.has(l.id)).map((l) => l.variant_id)),
    ];
    type OutLine = {
      id: string;
      movement_id: string;
      variant_id: string;
      source_location_id: string | null;
      destination_location_id: string | null;
      quantity: number;
    };
    const outLines: OutLine[] = [];
    if (relocationLineIds.length > 0) {
      const { data } = await supabase
        .from("inventory_movement_lines")
        .select(
          "id, movement_id, variant_id, source_location_id, destination_location_id, quantity"
        )
        .in("id", relocationLineIds);
      outLines.push(...((data ?? []) as OutLine[]));
    }
    const freeOut: OutLine[] = [];
    if (receiving && freeVariantIds.length > 0) {
      let query = supabase
        .from("inventory_movement_lines")
        .select(
          "id, movement_id, variant_id, source_location_id, destination_location_id, quantity"
        )
        .eq("source_location_id", receiving)
        .in("variant_id", freeVariantIds);
      if (input.postedAt) query = query.gte("created_at", input.postedAt);
      const { data } = await query;
      const relocationSet = new Set(relocationLineIds);
      freeOut.push(...((data ?? []) as OutLine[]).filter((l) => !relocationSet.has(l.id)));
    }

    const all = [...outLines, ...freeOut];
    const movementIds = [...new Set(all.map((l) => l.movement_id))];
    const locationIds = new Set(
      all.map((l) => l.destination_location_id).filter((id): id is string => !!id)
    );

    const roIds = [...new Set(roByRol.values())];
    const containersByRo = new Map<
      string,
      Array<{ id: string; code: string; current_location_id: string | null }>
    >();
    const containerVariants = new Map<string, Set<string>>();
    if (roIds.length > 0) {
      const { data: containers } = await supabase
        .from("inventory_containers")
        .select("id, code, reference_id, current_location_id")
        .eq("reference_type", "repair_order")
        .in("reference_id", roIds)
        .is("deleted_at", null);
      const rows = (containers ?? []) as Array<{
        id: string;
        code: string;
        reference_id: string;
        current_location_id: string | null;
      }>;
      for (const c of rows) {
        const list = containersByRo.get(c.reference_id) ?? [];
        list.push(c);
        containersByRo.set(c.reference_id, list);
        if (c.current_location_id) locationIds.add(c.current_location_id);
      }
      if (rows.length > 0) {
        const { data: clines } = await supabase
          .from("inventory_container_lines")
          .select("container_id, variant_id")
          .in(
            "container_id",
            rows.map((c) => c.id)
          )
          .is("deleted_at", null);
        for (const cl of (clines ?? []) as Array<{ container_id: string; variant_id: string }>) {
          const set = containerVariants.get(cl.container_id) ?? new Set<string>();
          set.add(cl.variant_id);
          containerVariants.set(cl.container_id, set);
        }
      }
    }

    const [{ data: headers }, { data: locations }] = await Promise.all([
      movementIds.length > 0
        ? supabase
            .from("inventory_movement_headers")
            .select("id, document_number")
            .in("id", movementIds)
        : Promise.resolve({ data: [] }),
      locationIds.size > 0
        ? supabase
            .from("warehouse_locations")
            .select("id, code, name")
            .in("id", [...locationIds])
        : Promise.resolve({ data: [] }),
    ]);
    const docById = new Map(
      ((headers ?? []) as Array<{ id: string; document_number: string | null }>).map((h) => [
        h.id,
        h.document_number,
      ])
    );
    const locById = new Map(
      ((locations ?? []) as Array<{ id: string; code: string | null; name: string }>).map((l) => [
        l.id,
        l,
      ])
    );
    const outById = new Map(all.map((l) => [l.id, l]));

    function putawayRow(line: OutLine, quantity: number): ReceiptReportPutaway {
      const loc = line.destination_location_id ? locById.get(line.destination_location_id) : null;
      return {
        locationCode: loc?.code ?? null,
        locationName: loc?.name ?? null,
        quantity,
        documentNumber: docById.get(line.movement_id) ?? null,
      };
    }

    const freePending = new Map<string, number>();
    for (const it of pendingItems) {
      if (!it.repairOrderLineId) freePending.set(it.variantId, it.quantity);
    }
    const freeOutRemaining = new Map<string, OutLine[]>();
    for (const l of freeOut) {
      const list = freeOutRemaining.get(l.variant_id) ?? [];
      list.push(l);
      freeOutRemaining.set(l.variant_id, list);
    }

    const report = input.lines.map((line) => {
      const rolId = rolByLine.get(line.id) ?? null;
      const roId = rolId ? (roByRol.get(rolId) ?? null) : null;
      let putaway: ReceiptReportPutaway[] = [];
      let pendingQuantity = 0;

      if (rolId) {
        putaway = (putawayByRol.get(rolId) ?? [])
          .map((r) => {
            const out = outById.get(r.lineId);
            return out && (!receiving || out.source_location_id === receiving)
              ? putawayRow(out, r.quantity)
              : null;
          })
          .filter((r): r is ReceiptReportPutaway => r !== null);
        pendingQuantity = pendingItems.find((it) => it.repairOrderLineId === rolId)?.quantity ?? 0;
      } else {
        // Consume the free 801s for this item in order, up to the line quantity.
        let left = line.quantity;
        const outs = freeOutRemaining.get(line.variant_id) ?? [];
        while (left > 0 && outs.length > 0) {
          const out = outs[0];
          const take = Math.min(left, Number(out.quantity));
          putaway.push(putawayRow(out, take));
          left -= take;
          if (take >= Number(out.quantity)) outs.shift();
          else out.quantity = Number(out.quantity) - take;
        }
        const waiting = freePending.get(line.variant_id) ?? 0;
        pendingQuantity = Math.min(waiting, line.quantity);
        freePending.set(line.variant_id, waiting - pendingQuantity);
      }

      const containers = roId
        ? (containersByRo.get(roId) ?? [])
            .filter((c) => containerVariants.get(c.id)?.has(line.variant_id))
            .map((c) => {
              const loc = c.current_location_id ? locById.get(c.current_location_id) : null;
              return {
                code: c.code,
                locationCode: loc?.code ?? null,
                locationName: loc?.name ?? null,
              };
            })
        : [];

      return {
        lineNumber: line.line_number,
        sku: line.sku,
        productName: line.product_name,
        quantity: Number(line.quantity),
        unitCode: line.unit_code,
        zlNumber: roId ? (zlByRo.get(roId) ?? null) : null,
        putaway,
        containers,
        pendingQuantity,
      } satisfies ReceiptReportLine;
    });

    return { success: true, data: report };
  }
}
