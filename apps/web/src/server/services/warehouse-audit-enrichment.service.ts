import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CountLineRow,
  EnrichedCountLine,
  EnrichedReorderReportRow,
  ReorderReportRow,
} from "@/lib/warehouse/count-session-types";

/**
 * Shared enrichment helpers for the stock-audit feature. Both the SSR pages
 * (guided-count, variance-review, final-report, standalone reorder report)
 * and the server actions the client-side React Query hooks call through
 * (getInventoryCountSessionAction, getReorderReportAction) import from here,
 * so a post-mutation client-side refetch always returns the same
 * display-ready shape as the initial server-rendered paint — not a raw,
 * unenriched DB row.
 */

/**
 * Mirrors the pattern in InventoryBalancesService: separate selects +
 * in-memory join, not a single deep nested query.
 */
export async function enrichCountLines(
  supabase: SupabaseClient,
  lines: CountLineRow[]
): Promise<EnrichedCountLine[]> {
  if (lines.length === 0) return [];

  const variantIds = [...new Set(lines.map((l) => l.variant_id))];
  const locationIds = [...new Set(lines.map((l) => l.location_id))];
  const unitIds = [...new Set(lines.map((l) => l.unit_id))];

  const [variantsRes, locationsRes, unitsRes] = await Promise.all([
    supabase.from("inventory_variants").select("id, product_id, sku, name").in("id", variantIds),
    supabase.from("warehouse_locations").select("id, code, name").in("id", locationIds),
    supabase.from("inventory_units").select("id, code").in("id", unitIds),
  ]);

  const variants = (variantsRes.data ?? []) as {
    id: string;
    product_id: string;
    sku: string;
    name: string | null;
  }[];
  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const productsRes = productIds.length
    ? await supabase.from("inventory_products").select("id, name").in("id", productIds)
    : { data: [] };
  const products = (productsRes.data ?? []) as { id: string; name: string }[];

  const variantsById = new Map(variants.map((v) => [v.id, v]));
  const productsById = new Map(products.map((p) => [p.id, p]));
  const locationsById = new Map(
    ((locationsRes.data ?? []) as { id: string; code: string | null; name: string }[]).map((l) => [
      l.id,
      l,
    ])
  );
  const unitsById = new Map(
    ((unitsRes.data ?? []) as { id: string; code: string }[]).map((u) => [u.id, u])
  );

  return lines.map((line) => {
    const variant = variantsById.get(line.variant_id);
    const product = variant ? productsById.get(variant.product_id) : undefined;
    const location = locationsById.get(line.location_id);
    const unit = unitsById.get(line.unit_id);

    return {
      ...line,
      sku: variant?.sku ?? "—",
      productName: product?.name ?? variant?.name ?? "—",
      unitCode: unit?.code ?? "",
      locationCode: location?.code ?? location?.name ?? "—",
      locationName: location?.name ?? "—",
    };
  });
}

/**
 * Enriches raw ReorderReportRow (variant_id/location_id/supplier_id
 * foreign-key-only rows from InventoryCountSessionsService.getReorderReport)
 * with display data, plus the latest accept/ignore decision from
 * inventory_reorder_suggestion_actions. Same separate-selects-then-join
 * pattern as enrichCountLines.
 */
export async function enrichReorderReportRows(
  supabase: SupabaseClient,
  orgId: string,
  branchId: string,
  rows: ReorderReportRow[]
): Promise<EnrichedReorderReportRow[]> {
  if (rows.length === 0) return [];

  const variantIds = [...new Set(rows.map((r) => r.variant_id))];
  const locationIds = [
    ...new Set(rows.map((r) => r.location_id).filter((id): id is string => !!id)),
  ];
  const supplierIds = [
    ...new Set(rows.map((r) => r.preferred_supplier_id).filter((id): id is string => !!id)),
  ];

  const [variantsRes, locationsRes, suppliersRes, actionsRes] = await Promise.all([
    supabase.from("inventory_variants").select("id, product_id, sku, name").in("id", variantIds),
    locationIds.length
      ? supabase.from("warehouse_locations").select("id, code, name").in("id", locationIds)
      : Promise.resolve({ data: [] }),
    supplierIds.length
      ? supabase.from("inventory_suppliers").select("id, name").in("id", supplierIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("inventory_reorder_suggestion_actions")
      .select("variant_id, location_id, status, created_at")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .order("created_at", { ascending: true }),
  ]);

  const variants = (variantsRes.data ?? []) as {
    id: string;
    product_id: string;
    sku: string;
    name: string | null;
  }[];
  const productIds = [...new Set(variants.map((v) => v.product_id))];
  const productsRes = productIds.length
    ? await supabase
        .from("inventory_products")
        .select("id, name, base_unit_id")
        .in("id", productIds)
    : { data: [] };
  const products = (productsRes.data ?? []) as {
    id: string;
    name: string;
    base_unit_id: string | null;
  }[];
  const unitIds = [
    ...new Set(products.map((p) => p.base_unit_id).filter((id): id is string => !!id)),
  ];
  const unitsRes = unitIds.length
    ? await supabase.from("inventory_units").select("id, code").in("id", unitIds)
    : { data: [] };

  const variantsById = new Map(variants.map((v) => [v.id, v]));
  const productsById = new Map(products.map((p) => [p.id, p]));
  const unitsById = new Map(
    ((unitsRes.data ?? []) as { id: string; code: string }[]).map((u) => [u.id, u])
  );
  const locationsById = new Map(
    ((locationsRes.data ?? []) as { id: string; code: string | null; name: string }[]).map((l) => [
      l.id,
      l,
    ])
  );
  const suppliersById = new Map(
    ((suppliersRes.data ?? []) as { id: string; name: string }[]).map((s) => [s.id, s])
  );

  const actionByKey = new Map<string, "accepted" | "ignored">();
  for (const action of (actionsRes.data ?? []) as Array<{
    variant_id: string;
    location_id: string | null;
    status: "accepted" | "ignored";
  }>) {
    actionByKey.set(`${action.variant_id}:${action.location_id ?? ""}`, action.status);
  }

  return rows.map((row) => {
    const variant = variantsById.get(row.variant_id);
    const product = variant ? productsById.get(variant.product_id) : undefined;
    const unit = product?.base_unit_id ? unitsById.get(product.base_unit_id) : undefined;
    const location = row.location_id ? locationsById.get(row.location_id) : undefined;
    const supplier = row.preferred_supplier_id
      ? suppliersById.get(row.preferred_supplier_id)
      : undefined;

    return {
      ...row,
      sku: variant?.sku ?? "—",
      productName: product?.name ?? variant?.name ?? "—",
      unitCode: unit?.code ?? "",
      locationCode: location?.code ?? location?.name ?? null,
      locationName: location?.name ?? null,
      supplierName: supplier?.name ?? null,
      actionStatus: actionByKey.get(`${row.variant_id}:${row.location_id ?? ""}`) ?? null,
    };
  });
}
