import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * DMS warehouses (magazyny) of a branch, e.g. 3112 Volkswagen, 3332 Škoda (table
 * branch_warehouses, migration 20261008120213). A code belongs to one branch per organization;
 * orderPrefix is the repair-order number prefix that warehouse uses (ZL / ZLEC), so a full
 * number can be built from number + warehouse. Writes need branches.update (RLS).
 */
export interface BranchWarehouse {
  id: string;
  branchId: string;
  code: string;
  name: string | null;
  orderPrefix: "ZL" | "ZLEC";
}

export interface BranchWarehouseInput {
  code: string;
  name: string | null;
  orderPrefix: "ZL" | "ZLEC";
}

type Row = {
  id: string;
  branch_id: string;
  code: string;
  name: string | null;
  order_prefix: "ZL" | "ZLEC";
};

const COLUMNS = "id, branch_id, code, name, order_prefix";

const map = (r: Row): BranchWarehouse => ({
  id: r.id,
  branchId: r.branch_id,
  code: r.code,
  name: r.name,
  orderPrefix: r.order_prefix,
});

function friendly(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "duplicate_code";
  if (error.code === "42501") return "forbidden";
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
}

/** Full DMS repair-order number from its parts, e.g. ZL/178024/26/3112/BL. */
export function composeRepairOrderNumber(
  warehouse: Pick<BranchWarehouse, "code" | "orderPrefix">,
  orderNo: string,
  year: number
): string {
  return `${warehouse.orderPrefix}/${orderNo}/${String(year % 100).padStart(2, "0")}/${warehouse.code}/BL`;
}
