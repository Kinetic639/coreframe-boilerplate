import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Stock per AutoStacja magazyn (U2, docs/WAREHOUSE_UNITS_PLAN.md).
 *
 * The magazyn is an ownership balance next to the physical stock: how many
 * pieces of a part belong to magazyn 115, 116… of the branch, wherever they lie.
 * The database keeps it (inventory_warehouse_stock, fed from the stock ledger
 * by the magazyn of each movement line). This service resolves the magazyn of
 * Matcher-imported PZ lines and reads the stock back.
 */

/** One jednostka of the branch with its magazyny, as needed to place a line. */
export interface UnitForResolve {
  code: string;
  defaultWarehouseId: string | null;
  warehouses: Array<{ id: string; code: string }>;
}

/**
 * The magazyn a delivered line goes to: the magazyn named in the document
 * (by code, within the branch), else the default magazyn of the line's
 * jednostka (from its ZW), else none -- the line then stays "without magazyn".
 */
export function pickWarehouse(
  source: { warehouseCode: string | null; unitCode: string | null },
  units: UnitForResolve[]
): string | null {
  if (source.warehouseCode) {
    for (const unit of units) {
      const hit = unit.warehouses.find((w) => w.code === source.warehouseCode);
      if (hit) return hit.id;
    }
  }
  if (source.unitCode) {
    const unit = units.find((u) => u.code === source.unitCode);
    if (unit?.defaultWarehouseId) return unit.defaultWarehouseId;
  }
  return null;
}

/** "ZW/806/26/3252" -> "3252" */
export function unitCodeFromZw(zw: string | null | undefined): string | null {
  const part = zw?.split("/")[3]?.trim() ?? "";
  return /^[0-9]{3,5}$/.test(part) ? part : null;
}

function metaString(meta: Record<string, unknown> | null | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function warehouseCodeOf(meta: Record<string, unknown> | null | undefined) {
  const code = metaString(meta, "warehouse_code");
  return code && /^[0-9]{2,5}$/.test(code) ? code : null;
}

export interface WarehouseStockRow {
  warehouseId: string;
  warehouseCode: string;
  warehouseName: string | null;
  unitCode: string;
  unitName: string | null;
  quantity: number;
}

export interface VariantWarehouseStock {
  rows: WarehouseStockRow[];
  /** Physical stock of the branch not booked to any magazyn yet */
  withoutWarehouse: number;
  onHand: number;
}

export class WarehouseStockService {
  static async branchUnits(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<UnitForResolve[]>> {
    const { data, error } = await supabase
      .from("branch_warehouses")
      .select(
        "code, default_warehouse_id, unit_warehouses!unit_warehouses_unit_id_fkey(id, code, is_active, deleted_at)"
      )
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    type Row = {
      code: string;
      default_warehouse_id: string | null;
      unit_warehouses: Array<{
        id: string;
        code: string;
        is_active: boolean;
        deleted_at: string | null;
      }> | null;
    };
    return {
      success: true,
      data: ((data ?? []) as Row[]).map((u) => ({
        code: u.code,
        defaultWarehouseId: u.default_warehouse_id,
        warehouses: (u.unit_warehouses ?? [])
          .filter((w) => !w.deleted_at && w.is_active)
          .map((w) => ({ id: w.id, code: w.code })),
      })),
    };
  }

  /**
   * The magazyn of each Matcher line delivered on a PZ. A WDD line takes the
   * magazyn and ZW of the brand order it was matched to (as the import does),
   * a direct BC order line its own block's.
   */
  static async resolveMatcherLineWarehouses(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    lineIds: string[]
  ): Promise<ServiceResult<Map<string, string>>> {
    const ids = [...new Set(lineIds)];
    const out = new Map<string, string>();
    if (ids.length === 0) return { success: true, data: out };

    const { data: lines, error: linesError } = await supabase
      .from("wdd_matcher_lines")
      .select("id, block_id")
      .eq("organization_id", orgId)
      .in("id", ids);
    if (linesError) return { success: false, error: linesError.message };
    const lineRows = (lines ?? []) as Array<{ id: string; block_id: string }>;
    const blockIds = [...new Set(lineRows.map((l) => l.block_id))];
    if (blockIds.length === 0) return { success: true, data: out };

    const [blocksRes, matchesRes, unitsRes] = await Promise.all([
      supabase
        .from("wdd_matcher_blocks")
        .select("id, block_type, metadata")
        .eq("organization_id", orgId)
        .in("id", blockIds),
      supabase
        .from("wdd_matcher_block_matches")
        .select("bc_block_id, wdd_block_id, brand_block_id, block_confidence")
        .eq("organization_id", orgId)
        .or(`bc_block_id.in.(${blockIds.join(",")}),wdd_block_id.in.(${blockIds.join(",")})`),
      WarehouseStockService.branchUnits(supabase, orgId, branchId),
    ]);
    if (blocksRes.error) return { success: false, error: blocksRes.error.message };
    if (matchesRes.error) return { success: false, error: matchesRes.error.message };
    if (!unitsRes.success) return unitsRes as ServiceResult<never>;

    type Block = { id: string; block_type: string; metadata: Record<string, unknown> | null };
    type Match = {
      bc_block_id: string | null;
      wdd_block_id: string | null;
      brand_block_id: string | null;
      block_confidence: number | null;
    };
    const blocks = new Map(((blocksRes.data ?? []) as Block[]).map((b) => [b.id, b]));
    const bestMatch = new Map<string, Match>();
    for (const m of (matchesRes.data ?? []) as Match[]) {
      const key = m.bc_block_id ?? m.wdd_block_id;
      if (!key) continue;
      const current = bestMatch.get(key);
      if (!current || (m.block_confidence ?? 0) > (current.block_confidence ?? 0)) {
        bestMatch.set(key, m);
      }
    }

    const brandIds = [
      ...new Set(
        [...bestMatch.values()]
          .map((m) => m.brand_block_id)
          .filter((id): id is string => !!id && !blocks.has(id))
      ),
    ];
    if (brandIds.length > 0) {
      const { data: brands, error } = await supabase
        .from("wdd_matcher_blocks")
        .select("id, block_type, metadata")
        .eq("organization_id", orgId)
        .in("id", brandIds);
      if (error) return { success: false, error: error.message };
      for (const b of (brands ?? []) as Block[]) blocks.set(b.id, b);
    }

    for (const line of lineRows) {
      const block = blocks.get(line.block_id);
      if (!block) continue;
      const match = bestMatch.get(block.id);
      const order = match?.brand_block_id ? blocks.get(match.brand_block_id) : undefined;
      const warehouseId = pickWarehouse(
        {
          warehouseCode: warehouseCodeOf(order?.metadata) ?? warehouseCodeOf(block.metadata),
          unitCode: unitCodeFromZw(
            metaString(order?.metadata, "zw_number") ?? metaString(block.metadata, "zw_number")
          ),
        },
        unitsRes.data
      );
      if (warehouseId) out.set(line.id, warehouseId);
    }
    return { success: true, data: out };
  }

  /** How much of a part each magazyn of the branch holds, and what is not booked to one. */
  static async forVariant(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    variantId: string
  ): Promise<ServiceResult<VariantWarehouseStock>> {
    const [stockRes, balanceRes] = await Promise.all([
      supabase
        .from("inventory_warehouse_stock")
        .select(
          "quantity, unit_warehouses!inner(id, code, name, branch_warehouses!unit_warehouses_unit_id_fkey(code, name))"
        )
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .eq("variant_id", variantId),
      supabase
        .from("inventory_balances")
        .select("on_hand_quantity")
        .eq("organization_id", orgId)
        .eq("branch_id", branchId)
        .eq("variant_id", variantId),
    ]);
    if (stockRes.error) return { success: false, error: stockRes.error.message };
    if (balanceRes.error) return { success: false, error: balanceRes.error.message };

    type Row = {
      quantity: number | string;
      unit_warehouses: {
        id: string;
        code: string;
        name: string | null;
        branch_warehouses: { code: string; name: string | null } | null;
      };
    };
    const rows = ((stockRes.data ?? []) as unknown as Row[])
      .map((r) => ({
        warehouseId: r.unit_warehouses.id,
        warehouseCode: r.unit_warehouses.code,
        warehouseName: r.unit_warehouses.name,
        unitCode: r.unit_warehouses.branch_warehouses?.code ?? "",
        unitName: r.unit_warehouses.branch_warehouses?.name ?? null,
        quantity: Number(r.quantity),
      }))
      .filter((r) => r.quantity !== 0)
      .sort(
        (a, b) =>
          a.unitCode.localeCompare(b.unitCode) || a.warehouseCode.localeCompare(b.warehouseCode)
      );
    const onHand = ((balanceRes.data ?? []) as Array<{ on_hand_quantity: number | string }>).reduce(
      (sum, b) => sum + Number(b.on_hand_quantity),
      0
    );
    const booked = rows.reduce((sum, r) => sum + r.quantity, 0);
    return {
      success: true,
      data: { rows, onHand, withoutWarehouse: Math.max(0, onHand - booked) },
    };
  }
}
