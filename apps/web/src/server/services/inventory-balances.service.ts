import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/components/data-view/data-view.types";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export type InventoryBalanceListRow = {
  id: string;
  variant_id: string;
  sku: string;
  product_name: string;
  location_name: string;
  location_code: string | null;
  on_hand_quantity: number;
  available_quantity: number;
  unit_code: string;
  average_unit_cost: number;
  total_value: number;
  currency: string;
  last_movement_id: string | null;
  last_movement_number: string | null;
  last_movement_at: string | null;
  updated_at: string;
};

export type InventoryBalanceDetail = InventoryBalanceListRow & {
  reserved_quantity: number;
  allocated_quantity: number;
};

type BalanceRow = {
  id: string;
  location_id: string;
  variant_id: string;
  on_hand_quantity: number;
  reserved_quantity: number;
  allocated_quantity: number;
  available_quantity: number | null;
  last_movement_id: string | null;
  last_movement_at: string | null;
  updated_at: string;
};

type VariantRow = {
  id: string;
  product_id: string;
  sku: string;
};

type ProductRow = {
  id: string;
  name: string;
  base_unit_id: string;
};

type LocationRow = {
  id: string;
  name: string;
  code: string | null;
};

type UnitRow = {
  id: string;
  code: string;
};

type MovementRow = {
  id: string;
  movement_number: string;
};

type CostRow = {
  variant_id: string;
  average_unit_cost: number;
  currency: string;
};

const BALANCE_COLUMNS =
  "id, location_id, variant_id, on_hand_quantity, reserved_quantity, allocated_quantity, available_quantity, last_movement_id, last_movement_at, updated_at" as const;

function toNumber(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function applyBalanceSort(query: any, sort: DataViewListParams["sort"]) {
  const sortMap: Record<string, string> = {
    sku: "updated_at",
    product_name: "updated_at",
    location_name: "updated_at",
    on_hand_quantity: "on_hand_quantity",
    available_quantity: "available_quantity",
    updated_at: "updated_at",
  };
  const field = sort?.field ? sortMap[sort.field] : "updated_at";
  return query.order(field ?? "updated_at", { ascending: sort?.direction === "asc" });
}

export class InventoryBalancesService {
  static async listBalances(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    params: DataViewListParams
  ): Promise<ServiceResult<PaginatedResult<InventoryBalanceListRow>>> {
    let query = supabase
      .from("inventory_balances")
      .select(BALANCE_COLUMNS, { count: "exact" })
      .eq("organization_id", orgId)
      .eq("branch_id", branchId);

    const locationId = params.filters.location_id;
    if (typeof locationId === "string" && locationId) {
      query = query.eq("location_id", locationId);
    }

    const from = (params.page - 1) * params.pageSize;
    const to = from + params.pageSize - 1;
    const { data, error, count } = await applyBalanceSort(query, params.sort).range(from, to);
    if (error) return { success: false, error: error.message };

    const rows = await InventoryBalancesService.enrichBalances(
      supabase,
      orgId,
      branchId,
      (data ?? []) as BalanceRow[]
    );
    if (!rows.success)
      return { success: false, error: (rows as { success: false; error: string }).error };

    return {
      success: true,
      data: {
        rows: rows.data,
        totalCount: count ?? rows.data.length,
        page: params.page,
        pageSize: params.pageSize,
      },
    };
  }

  static async getBalanceDetail(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    balanceId: string
  ): Promise<ServiceResult<InventoryBalanceDetail | null>> {
    const { data, error } = await supabase
      .from("inventory_balances")
      .select(BALANCE_COLUMNS)
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .eq("id", balanceId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: null };

    const rows = await InventoryBalancesService.enrichBalances(supabase, orgId, branchId, [
      data as BalanceRow,
    ]);
    if (!rows.success)
      return { success: false, error: (rows as { success: false; error: string }).error };

    return {
      success: true,
      data: {
        ...rows.data[0],
        reserved_quantity: toNumber((data as BalanceRow).reserved_quantity),
        allocated_quantity: toNumber((data as BalanceRow).allocated_quantity),
      },
    };
  }

  private static async enrichBalances(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string,
    balances: BalanceRow[]
  ): Promise<ServiceResult<InventoryBalanceListRow[]>> {
    if (balances.length === 0) return { success: true, data: [] };

    const variantIds = [...new Set(balances.map((b) => b.variant_id))];
    const locationIds = [...new Set(balances.map((b) => b.location_id))];
    const movementIds = [
      ...new Set(balances.map((b) => b.last_movement_id).filter((id): id is string => !!id)),
    ];

    const { data: variantsData, error: variantsError } = await supabase
      .from("inventory_variants")
      .select("id, product_id, sku")
      .eq("organization_id", orgId)
      .in("id", variantIds);
    if (variantsError) return { success: false, error: variantsError.message };

    const variants = (variantsData ?? []) as VariantRow[];
    const productIds = [...new Set(variants.map((v) => v.product_id))];
    const { data: productsData, error: productsError } = productIds.length
      ? await supabase
          .from("inventory_products")
          .select("id, name, base_unit_id")
          .eq("organization_id", orgId)
          .in("id", productIds)
      : { data: [], error: null };
    if (productsError) return { success: false, error: productsError.message };

    const products = (productsData ?? []) as ProductRow[];
    const unitIds = [...new Set(products.map((p) => p.base_unit_id))];
    const { data: unitsData, error: unitsError } = unitIds.length
      ? await supabase
          .from("inventory_units")
          .select("id, code")
          .eq("organization_id", orgId)
          .in("id", unitIds)
      : { data: [], error: null };
    if (unitsError) return { success: false, error: unitsError.message };

    const { data: locationsData, error: locationsError } = await supabase
      .from("warehouse_locations")
      .select("id, name, code")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .in("id", locationIds);
    if (locationsError) return { success: false, error: locationsError.message };

    const { data: movementsData, error: movementsError } = movementIds.length
      ? await supabase
          .from("inventory_movement_headers")
          .select("id, movement_number")
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .in("id", movementIds)
      : { data: [], error: null };
    if (movementsError) return { success: false, error: movementsError.message };

    const { data: costsData, error: costsError } = variantIds.length
      ? await supabase
          .from("inventory_variant_costs")
          .select("variant_id, average_unit_cost, currency")
          .eq("organization_id", orgId)
          .eq("branch_id", branchId)
          .in("variant_id", variantIds)
      : { data: [], error: null };
    if (costsError) return { success: false, error: costsError.message };

    const variantsById = new Map(variants.map((v) => [v.id, v]));
    const productsById = new Map(products.map((p) => [p.id, p]));
    const unitsById = new Map(((unitsData ?? []) as UnitRow[]).map((u) => [u.id, u]));
    const locationsById = new Map(((locationsData ?? []) as LocationRow[]).map((l) => [l.id, l]));
    const movementsById = new Map(((movementsData ?? []) as MovementRow[]).map((m) => [m.id, m]));
    const costsByVariant = new Map(((costsData ?? []) as CostRow[]).map((c) => [c.variant_id, c]));

    return {
      success: true,
      data: balances.map((balance) => {
        const variant = variantsById.get(balance.variant_id);
        const product = variant ? productsById.get(variant.product_id) : undefined;
        const location = locationsById.get(balance.location_id);
        const movement = balance.last_movement_id
          ? movementsById.get(balance.last_movement_id)
          : undefined;
        const cost = costsByVariant.get(balance.variant_id);
        const onHand = toNumber(balance.on_hand_quantity);
        const averageUnitCost = toNumber(cost?.average_unit_cost);

        return {
          id: balance.id,
          variant_id: balance.variant_id,
          sku: variant?.sku ?? "",
          product_name: product?.name ?? "",
          location_name: location?.name ?? "",
          location_code: location?.code ?? null,
          on_hand_quantity: onHand,
          available_quantity: toNumber(balance.available_quantity),
          unit_code: product ? (unitsById.get(product.base_unit_id)?.code ?? "") : "",
          average_unit_cost: averageUnitCost,
          total_value: averageUnitCost * onHand,
          currency: cost?.currency ?? "PLN",
          last_movement_id: balance.last_movement_id,
          last_movement_number: movement?.movement_number ?? null,
          last_movement_at: balance.last_movement_at,
          updated_at: balance.updated_at,
        };
      }),
    };
  }
}
