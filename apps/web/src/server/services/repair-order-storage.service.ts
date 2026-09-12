import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Zone 5 Phase 5 -- current RepairOrder storage read model.
 *
 * Reads directly from `repair_order_line_locations` (the current/last-known
 * spatial projection, maintained by receive_repair_order_stock,
 * putaway_repair_order_stock, and the repair_order_location_attribution_sync
 * trigger -- see docs/mvp/zones/05-receiving-putaway-implementation-plan.md).
 *
 * Deliberately a plain client-side read + aggregation (not a new DB
 * function/view): the dataset per RepairOrder is small, the table already
 * has a client-readable RLS SELECT policy, and this avoids introducing yet
 * another DB object this session cannot live-verify (see the Phase 3
 * migration's own disclosed verification gap) when a read model this simple
 * doesn't need one -- "prefer read models over new subsystem", per the
 * approved plan.
 *
 * IMPORTANT: never re-derives KNOWN/UNKNOWN from live arithmetic. A
 * (location, variant) with any row in `repair_order_location_attribution_uncertain`
 * is UNKNOWN purely because that row exists -- full stop (plan §1.6a/§1.6c,
 * "no self-heal"). This service must not "helpfully" recompute confidence.
 */

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export type RepairOrderStorageSuggestion = {
  locationId: string;
  locationCode: string | null;
  locationName: string;
  distinctRepairOrderLines: number;
  currentQuantity: number;
  variants: Array<{ variantId: string; sku: string; productName: string; quantity: number }>;
  containerSummary: null; // reserved shape for PILOT; no backing column in pitch scope
  attributionStatus: "known" | "unknown";
};

type LocationRow = { id: string; code: string | null; name: string };
type VariantRow = {
  id: string;
  sku: string | null;
  product_name: string | null;
  unit_id: string | null;
};

/** Shape consumed directly by RepairOrderPutawayPanel's `receivedLines` prop. */
export type ReceivedLine = {
  repairOrderLineId: string;
  variantId: string;
  unitId: string;
  sku: string;
  productName: string;
  availableAtReceiving: number;
};

/**
 * getReceivedLines' result shape (external review, third correction pass).
 * `lines` contains ONLY actionable, confidently-KNOWN receiving stock --
 * never a bucket flagged `repair_order_location_attribution_uncertain`
 * (existence of that marker means the RepairOrder attribution for that
 * (location, variant) bucket is UNKNOWN; the projection row is then only
 * last-known/stale, never physical proof -- plan §D, and this session's
 * putaway RPC now independently enforces the same rule server-side).
 * `unverifiedLineCount` is a compact, honest signal for case C ("stock
 * exists but attribution requires verification") -- deliberately just a
 * count, not a reconciliation UI (out of pitch scope).
 */
export type ReceivedLinesResult = {
  lines: ReceivedLine[];
  unverifiedLineCount: number;
};

export class RepairOrderStorageService {
  /**
   * Current storage suggestions for a RepairOrder, ordered per the approved
   * plan's simple deterministic rule: highest current quantity first,
   * distinct-line-count as tiebreaker. No scoring, no capacity claims.
   */
  static async getStorageSuggestions(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    repairOrderId: string
  ): Promise<ServiceResult<RepairOrderStorageSuggestion[]>> {
    const { data: rows, error } = await supabase
      .from("repair_order_line_locations")
      .select("location_id, variant_id, repair_order_line_id, quantity")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("repair_order_id", repairOrderId)
      .gt("quantity", 0);
    if (error) return { success: false, error: error.message };

    const projectionRows = (rows ?? []) as Array<{
      location_id: string;
      variant_id: string | null;
      repair_order_line_id: string;
      quantity: number | string;
    }>;
    if (projectionRows.length === 0) return { success: true, data: [] };

    const locationIds = [...new Set(projectionRows.map((r) => r.location_id))];
    const variantIds = [
      ...new Set(projectionRows.map((r) => r.variant_id).filter(Boolean)),
    ] as string[];

    const [
      { data: uncertainRows, error: uncertainError },
      { data: locationRows, error: locError },
      { data: variantRows, error: varError },
    ] = await Promise.all([
      supabase
        .from("repair_order_location_attribution_uncertain")
        .select("location_id, variant_id")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId)
        .in("location_id", locationIds),
      supabase.from("warehouse_locations").select("id, code, name").in("id", locationIds),
      variantIds.length > 0
        ? supabase.from("inventory_variants").select("id, sku, product_name").in("id", variantIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (uncertainError) return { success: false, error: uncertainError.message };
    if (locError) return { success: false, error: locError.message };
    if (varError) return { success: false, error: varError.message };

    const uncertainKey = (locationId: string, variantId: string | null) =>
      `${locationId}::${variantId ?? ""}`;
    const uncertainSet = new Set(
      ((uncertainRows ?? []) as Array<{ location_id: string; variant_id: string }>).map((u) =>
        uncertainKey(u.location_id, u.variant_id)
      )
    );
    const locationsById = new Map(((locationRows ?? []) as LocationRow[]).map((l) => [l.id, l]));
    const variantsById = new Map(((variantRows ?? []) as VariantRow[]).map((v) => [v.id, v]));

    // Group by location. A location is UNKNOWN as a whole for this suggestion
    // list the moment ANY of its (location, variant) pairs present for this
    // RepairOrder is flagged uncertain -- never partially confident.
    const byLocation = new Map<
      string,
      {
        lines: Set<string>;
        totalQty: number;
        variants: Map<string, { sku: string; productName: string; quantity: number }>;
        unknown: boolean;
      }
    >();

    for (const row of projectionRows) {
      const entry = byLocation.get(row.location_id) ?? {
        lines: new Set<string>(),
        totalQty: 0,
        variants: new Map(),
        unknown: false,
      };
      entry.lines.add(row.repair_order_line_id);
      entry.totalQty += Number(row.quantity);
      if (uncertainSet.has(uncertainKey(row.location_id, row.variant_id))) {
        entry.unknown = true;
      }
      if (row.variant_id) {
        const variant = variantsById.get(row.variant_id);
        const existing = entry.variants.get(row.variant_id);
        const qty = Number(row.quantity);
        entry.variants.set(row.variant_id, {
          sku: variant?.sku ?? row.variant_id,
          productName: variant?.product_name ?? variant?.sku ?? row.variant_id,
          quantity: (existing?.quantity ?? 0) + qty,
        });
      }
      byLocation.set(row.location_id, entry);
    }

    const suggestions: RepairOrderStorageSuggestion[] = [...byLocation.entries()].map(
      ([locationId, entry]) => {
        const location = locationsById.get(locationId);
        return {
          locationId,
          locationCode: location?.code ?? null,
          locationName: location?.name ?? locationId,
          distinctRepairOrderLines: entry.lines.size,
          currentQuantity: entry.totalQty,
          variants: [...entry.variants.entries()].map(([variantId, v]) => ({
            variantId,
            sku: v.sku,
            productName: v.productName,
            quantity: v.quantity,
          })),
          containerSummary: null,
          attributionStatus: entry.unknown ? "unknown" : "known",
        };
      }
    );

    // Deterministic order (plan §5.1/§11.3): highest current quantity first,
    // distinct-line-count as tiebreaker. No AI/scoring complexity.
    suggestions.sort(
      (a, b) =>
        b.currentQuantity - a.currentQuantity ||
        b.distinctRepairOrderLines - a.distinctRepairOrderLines
    );

    return { success: true, data: suggestions };
  }

  /**
   * Lines of this RepairOrder currently sitting at the branch's designated
   * receiving location -- i.e. exactly what a "Put away" action should offer
   * the operator. Deliberately its own small query (not a filter over
   * getStorageSuggestions' grouped-by-location DTO), since putaway needs
   * line-level granularity (repair_order_line_id, variant_id, unit_id) that
   * the location-grouped suggestion shape intentionally doesn't carry.
   *
   * CORRECTION (external review, third pass): this previously read
   * `repair_order_line_locations` alone and offered every positive-quantity
   * row as a confident "Put away <quantity>" candidate, without checking
   * `repair_order_location_attribution_uncertain`. That is exactly backwards
   * per the architecture -- existence of a marker row means the bucket's
   * RepairOrder attribution is UNKNOWN, and the projection row is then only
   * last-known/stale, never authoritative physical identity. Any receiving
   * bucket flagged UNKNOWN is now excluded from the actionable `lines`
   * array entirely (never rendered as a confident putaway candidate); its
   * count is surfaced separately via `unverifiedLineCount` so the caller can
   * truthfully distinguish "nothing to put away" from "stock exists here but
   * requires attribution verification first" -- without building a
   * reconciliation UI (out of pitch scope).
   */
  static async getReceivedLines(
    supabase: SupabaseClient,
    organizationId: string,
    branchId: string,
    repairOrderId: string
  ): Promise<ServiceResult<ReceivedLinesResult>> {
    const { data: receivingLocation, error: locError } = await supabase
      .from("warehouse_locations")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("purpose", "receiving")
      .is("deleted_at", null)
      .maybeSingle();
    if (locError) return { success: false, error: locError.message };
    if (!receivingLocation) return { success: true, data: { lines: [], unverifiedLineCount: 0 } }; // no receiving location configured -- nothing to show, not an error

    const { data: rows, error } = await supabase
      .from("repair_order_line_locations")
      .select("repair_order_line_id, variant_id, quantity")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("repair_order_id", repairOrderId)
      .eq("location_id", receivingLocation.id)
      .gt("quantity", 0);
    if (error) return { success: false, error: error.message };

    const projectionRows = (rows ?? []) as Array<{
      repair_order_line_id: string;
      variant_id: string | null;
      quantity: number | string;
    }>;
    if (projectionRows.length === 0)
      return { success: true, data: { lines: [], unverifiedLineCount: 0 } };

    const variantIds = [
      ...new Set(projectionRows.map((r) => r.variant_id).filter(Boolean)),
    ] as string[];

    const [{ data: uncertainRows, error: uncertainError }, { data: variantRows, error: varError }] =
      await Promise.all([
        variantIds.length > 0
          ? supabase
              .from("repair_order_location_attribution_uncertain")
              .select("variant_id")
              .eq("organization_id", organizationId)
              .eq("branch_id", branchId)
              .eq("location_id", receivingLocation.id)
              .in("variant_id", variantIds)
          : Promise.resolve({ data: [] as Array<{ variant_id: string }>, error: null }),
        variantIds.length > 0
          ? supabase
              .from("inventory_variants")
              .select("id, sku, product_name, unit_id")
              .in("id", variantIds)
          : Promise.resolve({ data: [] as VariantRow[], error: null }),
      ]);
    if (uncertainError) return { success: false, error: uncertainError.message };
    if (varError) return { success: false, error: varError.message };

    const uncertainVariantIds = new Set(
      ((uncertainRows ?? []) as Array<{ variant_id: string }>).map((u) => u.variant_id)
    );
    const variantsById = new Map(((variantRows ?? []) as VariantRow[]).map((v) => [v.id, v]));

    const lines: ReceivedLine[] = [];
    let unverifiedLineCount = 0;
    for (const row of projectionRows) {
      if (!row.variant_id || !variantsById.get(row.variant_id)?.unit_id) continue;
      if (uncertainVariantIds.has(row.variant_id)) {
        // UNKNOWN at the receiving location for this variant -- the marker
        // is authoritative; never shown as a confident putaway candidate,
        // regardless of what this stale projection row says (no self-heal).
        unverifiedLineCount += 1;
        continue;
      }
      const variant = variantsById.get(row.variant_id)!;
      lines.push({
        repairOrderLineId: row.repair_order_line_id,
        variantId: row.variant_id,
        unitId: variant.unit_id as string,
        sku: variant.sku ?? row.variant_id,
        productName: variant.product_name ?? variant.sku ?? "",
        availableAtReceiving: Number(row.quantity),
      });
    }

    return { success: true, data: { lines, unverifiedLineCount } };
  }
}
