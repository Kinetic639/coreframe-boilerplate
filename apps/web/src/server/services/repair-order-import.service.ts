import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { svwmsWddMatcherRepairOrderImportAdapter } from "./repair-order-import-adapters/svwms-wdd-matcher.adapter";
import type {
  CanonicalRepairOrderImportOrder,
  RepairOrderImportSourceAdapter,
  RepairOrderImportSourceField,
  ServiceResult,
} from "./repair-order-import-adapters/types";

export type { RepairOrderImportSourceField } from "./repair-order-import-adapters/types";

/**
 * Generic repair-order import (Workshop). A source adapter turns its data
 * into canonical orders; `preview` verifies them against what exists
 * (existing / new / conflict, per part); `apply` creates the selected
 * ones through `repair_orders_import`. The PZ import reuses the same
 * preview/apply for the Matcher session it receives.
 */

const adapters: RepairOrderImportSourceAdapter[] = [svwmsWddMatcherRepairOrderImportAdapter];

export type RepairOrderImportSource = {
  sourceType: string;
  label: string;
  description: string;
  fields: RepairOrderImportSourceField[];
};

export type RepairOrderImportLineState =
  /** Not on the order yet: will be added. */
  | "new"
  /** On the order already; this import adds its quantity (new source line). */
  | "adds_quantity"
  /** On the order already; nothing changes. */
  | "on_order"
  /** This exact source line was imported before. */
  | "already_imported";

export type RepairOrderImportPreviewOrder = {
  zlNumber: string | null;
  status: "new" | "existing" | "conflict";
  conflictReason: "missing_zl" | "repair_order_closed" | "repair_order_archived" | null;
  repairOrderId: string | null;
  orderNumber: string | null;
  vin: string | null;
  vehicleBrand: string | null;
  clientName: string | null;
  /** True when importing this order changes anything. */
  willChange: boolean;
  lines: Array<{
    productCode: string | null;
    productName: string | null;
    quantity: number | null;
    unit: string | null;
    state: RepairOrderImportLineState;
  }>;
};

export type RepairOrderImportPreview = {
  sourceType: string;
  orders: RepairOrderImportPreviewOrder[];
  counts: { new: number; existing: number; conflict: number; unchanged: number };
};

export type RepairOrderImportResult = {
  created: number;
  updated: number;
  unchanged: number;
  conflicts: number;
};

export function normalizeProductCode(code: string | null | undefined): string | null {
  const value = (code ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return value || null;
}

function serviceError(result: { success: boolean }) {
  return (result as { success: false; error: string }).error;
}

/** Orders of one ZL can span several source blocks; verify them as one. */
function groupByZl(orders: CanonicalRepairOrderImportOrder[]) {
  const groups = new Map<string, CanonicalRepairOrderImportOrder[]>();
  const missing: CanonicalRepairOrderImportOrder[] = [];
  for (const order of orders) {
    if (!order.zlNumber) {
      missing.push(order);
      continue;
    }
    const list = groups.get(order.zlNumber) ?? [];
    list.push(order);
    groups.set(order.zlNumber, list);
  }
  return { groups, missing };
}

export class RepairOrderImportService {
  static getAdapter(sourceType: string) {
    return adapters.find((adapter) => adapter.sourceType === sourceType) ?? null;
  }

  static async listSources(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<RepairOrderImportSource[]>> {
    const sources: RepairOrderImportSource[] = [];
    for (const adapter of adapters) {
      const fields = await adapter.loadSourceFields(supabase, orgId, branchId);
      if (!fields.success) return { success: false, error: serviceError(fields) };
      sources.push({
        sourceType: adapter.sourceType,
        label: adapter.label,
        description: adapter.description,
        fields: fields.data,
      });
    }
    return { success: true, data: sources };
  }

  static async loadOrders(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sourceType: string,
    sourceInput: Record<string, unknown>
  ): Promise<ServiceResult<CanonicalRepairOrderImportOrder[]>> {
    const adapter = this.getAdapter(sourceType);
    if (!adapter) return { success: false, error: "Nieobsługiwane źródło importu" };
    return adapter.loadOrders(supabase, orgId, branchId, sourceInput);
  }

  static async preview(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    sourceType: string,
    sourceInput: Record<string, unknown>
  ): Promise<ServiceResult<RepairOrderImportPreview>> {
    const loaded = await this.loadOrders(supabase, orgId, branchId, sourceType, sourceInput);
    if (!loaded.success) return { success: false, error: serviceError(loaded) };
    const { groups, missing } = groupByZl(loaded.data);
    const zlNumbers = [...groups.keys()];

    const { data: roRows, error: roError } = zlNumbers.length
      ? await supabase
          .from("repair_orders")
          .select("id, zl_number, status")
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .in("zl_number", zlNumbers)
          .is("deleted_at", null)
      : { data: [], error: null };
    if (roError) return { success: false, error: "Nie udało się sprawdzić istniejących zleceń" };
    const roByZl = new Map(
      ((roRows ?? []) as Array<{ id: string; zl_number: string; status: string }>).map((r) => [
        r.zl_number,
        r,
      ])
    );

    const roIds = [...roByZl.values()].map((r) => r.id);
    const { data: lineRows } = roIds.length
      ? await supabase
          .from("repair_order_lines")
          .select("repair_order_id, product_code")
          .in("repair_order_id", roIds)
          .is("deleted_at", null)
      : { data: [] };
    const codesByRo = new Map<string, Set<string>>();
    for (const row of (lineRows ?? []) as Array<{
      repair_order_id: string;
      product_code: string | null;
    }>) {
      const code = normalizeProductCode(row.product_code);
      if (!code) continue;
      const set = codesByRo.get(row.repair_order_id) ?? new Set<string>();
      set.add(code);
      codesByRo.set(row.repair_order_id, set);
    }

    const matcherLineIds = loaded.data.flatMap((o) =>
      o.lines.map((l) => l.matcherLineId).filter((id): id is string => !!id)
    );
    const { data: importedRows } = matcherLineIds.length
      ? await supabase
          .from("workshop_source_document_lines")
          .select("wdd_matcher_line_id")
          .in("wdd_matcher_line_id", matcherLineIds)
      : { data: [] };
    const imported = new Set(
      ((importedRows ?? []) as Array<{ wdd_matcher_line_id: string | null }>)
        .map((r) => r.wdd_matcher_line_id)
        .filter((id): id is string => !!id)
    );

    const orders: RepairOrderImportPreviewOrder[] = [];
    for (const [zl, parts] of groups) {
      const ro = roByZl.get(zl) ?? null;
      const first = parts[0];
      const existingCodes = new Set(ro ? (codesByRo.get(ro.id) ?? []) : []);
      const conflict = ro && ro.status !== "open";
      const lines = parts.flatMap((part) =>
        part.lines.map((line) => {
          const code = normalizeProductCode(line.productCode);
          let state: RepairOrderImportLineState;
          if (line.matcherLineId && imported.has(line.matcherLineId)) state = "already_imported";
          else if (code && existingCodes.has(code))
            state = line.matcherLineId ? "adds_quantity" : "on_order";
          else state = "new";
          if (code && state === "new") existingCodes.add(code);
          return {
            productCode: line.productCode,
            productName: line.productName,
            quantity: line.quantity,
            unit: line.unit,
            state,
          };
        })
      );
      const changesLines = lines.some(
        (l) => (l.state === "new" || l.state === "adds_quantity") && (l.quantity ?? 0) > 0
      );
      orders.push({
        zlNumber: zl,
        status: conflict ? "conflict" : ro ? "existing" : "new",
        conflictReason: conflict
          ? ro.status === "archived"
            ? "repair_order_archived"
            : "repair_order_closed"
          : null,
        repairOrderId: ro?.id ?? null,
        orderNumber: first.orderNumber,
        vin: first.vin,
        vehicleBrand: first.vehicleBrand,
        clientName: first.clientName,
        willChange: !conflict && (!ro || changesLines),
        lines,
      });
    }
    for (const order of missing) {
      orders.push({
        zlNumber: null,
        status: "conflict",
        conflictReason: "missing_zl",
        repairOrderId: null,
        orderNumber: order.orderNumber,
        vin: order.vin,
        vehicleBrand: order.vehicleBrand,
        clientName: order.clientName,
        willChange: false,
        lines: order.lines.map((line) => ({
          productCode: line.productCode,
          productName: line.productName,
          quantity: line.quantity,
          unit: line.unit,
          state: "new" as const,
        })),
      });
    }

    orders.sort((a, b) =>
      (a.zlNumber ?? "￿").localeCompare(b.zlNumber ?? "￿", "pl", { numeric: true })
    );
    return {
      success: true,
      data: {
        sourceType,
        orders,
        counts: {
          new: orders.filter((o) => o.status === "new").length,
          existing: orders.filter((o) => o.status === "existing").length,
          conflict: orders.filter((o) => o.status === "conflict").length,
          unchanged: orders.filter((o) => o.status === "existing" && !o.willChange).length,
        },
      },
    };
  }

  /**
   * Create/update the selected ZLs. The orders are re-read from the source
   * on the server -- the client only says which ZLs.
   */
  static async apply(
    supabase: SupabaseClient,
    input: {
      actorUserId: string;
      organizationId: string;
      branchId: string;
      sourceType: string;
      sourceInput: Record<string, unknown>;
      zlNumbers: string[];
    }
  ): Promise<ServiceResult<RepairOrderImportResult>> {
    const loaded = await this.loadOrders(
      supabase,
      input.organizationId,
      input.branchId,
      input.sourceType,
      input.sourceInput
    );
    if (!loaded.success) return { success: false, error: serviceError(loaded) };
    const wanted = new Set(input.zlNumbers);
    const orders = loaded.data.filter((o) => o.zlNumber && wanted.has(o.zlNumber));
    if (orders.length === 0) return { success: false, error: "Nie wybrano żadnego zlecenia" };

    const { data, error } = await supabase.rpc("repair_orders_import", {
      p_actor_user_id: input.actorUserId,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_orders: orders.map((o) => ({
        zl_number: o.zlNumber,
        order_number: o.orderNumber,
        vin: o.vin,
        vehicle_brand: o.vehicleBrand,
        client_name: o.clientName,
        dealer_name: o.dealerName,
        source: o.source ? { session_id: o.source.sessionId, block_id: o.source.blockId } : null,
        lines: o.lines.map((l) => ({
          product_code: l.productCode,
          product_name: l.productName,
          quantity: l.quantity,
          unit: l.unit,
          raw_text: l.rawText,
          matcher_line_id: l.matcherLineId,
        })),
      })),
    });
    if (error) {
      if (error.code === "28000" || error.code === "42501") {
        return { success: false, error: "unauthorized" };
      }
      console.error("[RepairOrderImportService.apply] repair_orders_import failed:", error);
      return { success: false, error: "unexpected" };
    }
    const r = (data ?? {}) as Record<string, unknown>;
    return {
      success: true,
      data: {
        created: Number(r.created ?? 0),
        updated: Number(r.updated ?? 0),
        unchanged: Number(r.unchanged ?? 0),
        conflicts: Number(r.conflicts ?? 0),
      },
    };
  }
}
