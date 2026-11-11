import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Jednostki of a branch -- AutoStacja's branches, e.g. 3112 Volkswagen, 3332 Škoda (table
 * branch_warehouses, migration 20261008120213) -- each divided into magazyny, AS's
 * warehouses 115 / 315… (unit_warehouses, docs/WAREHOUSE_UNITS_PLAN.md). Codes are kept
 * exactly as in AS and are unique in the organization. orderPrefix is the repair-order
 * number prefix of the jednostka (ZL / ZLEC). Writes need branches.update or
 * warehouse.structure.manage for the branch (RLS).
 */
export interface UnitWarehouse {
  id: string;
  unitId: string;
  code: string;
  name: string | null;
  isActive: boolean;
}

export interface BranchWarehouse {
  id: string;
  branchId: string;
  code: string;
  name: string | null;
  orderPrefix: "ZL" | "ZLEC";
  defaultWarehouseId: string | null;
  warehouses: UnitWarehouse[];
}

export interface UnitWarehouseInput {
  code: string;
  name: string | null;
  isActive: boolean;
}

/** What the Matcher saw in this branch's sessions and the configuration lacks. */
export interface BranchStructureSuggestions {
  units: Array<{ code: string; name: string | null; seen: number }>;
  warehouses: Array<{ code: string; name: string | null; unitCode: string | null; seen: number }>;
}

export interface BranchWarehouseInput {
  code: string;
  name: string | null;
  orderPrefix: "ZL" | "ZLEC";
}

type WarehouseRow = {
  id: string;
  unit_id: string;
  code: string;
  name: string | null;
  is_active: boolean;
};

type Row = {
  id: string;
  branch_id: string;
  code: string;
  name: string | null;
  order_prefix: "ZL" | "ZLEC";
  default_warehouse_id: string | null;
  unit_warehouses?: WarehouseRow[] | null;
};

const WAREHOUSE_COLUMNS = "id, unit_id, code, name, is_active";
// Two relations link the tables (magazyny of a jednostka, its default magazyn): name the first
const COLUMNS = `id, branch_id, code, name, order_prefix, default_warehouse_id,
  unit_warehouses!unit_warehouses_unit_id_fkey(${WAREHOUSE_COLUMNS})`;

const mapWarehouse = (r: WarehouseRow): UnitWarehouse => ({
  id: r.id,
  unitId: r.unit_id,
  code: r.code,
  name: r.name,
  isActive: r.is_active,
});

const map = (r: Row): BranchWarehouse => ({
  id: r.id,
  branchId: r.branch_id,
  code: r.code,
  name: r.name,
  orderPrefix: r.order_prefix,
  defaultWarehouseId: r.default_warehouse_id,
  warehouses: (r.unit_warehouses ?? [])
    .map(mapWarehouse)
    .sort((a, b) => a.code.localeCompare(b.code)),
});

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "duplicate_code";
  if (error.code === "42501") return "forbidden";
  // The branch guard: the branch is deleted or belongs to another organization
  if (error.code === "22023" && /branch/i.test(error.message)) return "branch_unavailable";
  return error.message;
}

export class BranchWarehousesService {
  /** Warehouses of one branch, or of the whole organization when branchId is null. */
  static async list(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null
  ): Promise<ServiceResult<BranchWarehouse[]>> {
    let q = supabase
      .from("branch_warehouses")
      .select(COLUMNS)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("code", { ascending: true });
    if (branchId) q = q.eq("branch_id", branchId);
    const { data, error } = await q;
    if (error) return { success: false, error: error.message };
    return { success: true, data: ((data ?? []) as Row[]).map(map) };
  }

  static async create(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    input: BranchWarehouseInput
  ): Promise<ServiceResult<BranchWarehouse>> {
    const { data, error } = await supabase
      .from("branch_warehouses")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        code: input.code,
        name: input.name,
        order_prefix: input.orderPrefix,
      })
      .select(COLUMNS)
      .single();
    if (error) return { success: false, error: friendly(error) };
    return { success: true, data: map(data as Row) };
  }

  static async update(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    input: BranchWarehouseInput
  ): Promise<ServiceResult<BranchWarehouse>> {
    const { data, error } = await supabase
      .from("branch_warehouses")
      .update({ code: input.code, name: input.name, order_prefix: input.orderPrefix })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(COLUMNS)
      .single();
    if (error) return { success: false, error: friendly(error) };
    return { success: true, data: map(data as Row) };
  }

  static async remove(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    const { data, error } = await supabase.rpc("branch_warehouse_remove", { p_id: id });
    if (error) return { success: false, error: friendly(error) };
    if (!data) return { success: false, error: "not_found" };
    return { success: true, data: null };
  }

  /** The magazyn PZ lines of this jednostka land in when a document names none. */
  static async setDefaultWarehouse(
    supabase: SupabaseClient,
    orgId: string,
    unitId: string,
    warehouseId: string | null
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase
      .from("branch_warehouses")
      .update({ default_warehouse_id: warehouseId })
      .eq("id", unitId)
      .eq("organization_id", orgId)
      .is("deleted_at", null);
    if (error) return { success: false, error: friendly(error) };
    return { success: true, data: null };
  }

  static async createWarehouse(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    unitId: string,
    input: UnitWarehouseInput
  ): Promise<ServiceResult<UnitWarehouse>> {
    // The table's trigger takes organization / branch from the jednostka anyway
    const { data, error } = await supabase
      .from("unit_warehouses")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        unit_id: unitId,
        code: input.code,
        name: input.name,
        is_active: input.isActive,
      })
      .select(WAREHOUSE_COLUMNS)
      .single();
    if (error) return { success: false, error: friendly(error) };
    return { success: true, data: mapWarehouse(data as WarehouseRow) };
  }

  static async updateWarehouse(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    input: UnitWarehouseInput
  ): Promise<ServiceResult<UnitWarehouse>> {
    const { data, error } = await supabase
      .from("unit_warehouses")
      .update({ code: input.code, name: input.name, is_active: input.isActive })
      .eq("id", id)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .select(WAREHOUSE_COLUMNS)
      .single();
    if (error) return { success: false, error: friendly(error) };
    return { success: true, data: mapWarehouse(data as WarehouseRow) };
  }

  static async removeWarehouse(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    const { data, error } = await supabase.rpc("unit_warehouse_remove", { p_id: id });
    if (error) return { success: false, error: friendly(error) };
    if (!data) return { success: false, error: "not_found" };
    return { success: true, data: null };
  }

  static async suggestions(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<BranchStructureSuggestions>> {
    const { data, error } = await supabase.rpc("branch_structure_suggestions", {
      p_org_id: orgId,
      p_branch_id: branchId,
    });
    if (error) return { success: false, error: error.message };
    const value = (data ?? {}) as Partial<BranchStructureSuggestions>;
    return {
      success: true,
      data: {
        units: (value.units ?? []).map((u) => ({ ...u, seen: Number(u.seen) })),
        warehouses: (value.warehouses ?? []).map((w) => ({ ...w, seen: Number(w.seen) })),
      },
    };
  }
}

/** Full DMS repair-order number from its parts, e.g. ZL/178024/26/3112/BL. */
export function composeRepairOrderNumber(
  warehouse: Pick<BranchWarehouse, "code" | "orderPrefix">,
  orderNo: string,
  year: number
): string {
  return `${warehouse.orderPrefix}/${orderNo}/${String(year % 100).padStart(2, "0")}/${warehouse.code}/BL`;
}
