import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CountLineRow } from "@/lib/warehouse/count-session-types";

/**
 * A count line enriched with display data (SKU, product name, unit, location)
 * fetched server-side via ad-hoc selects — inventory_count_lines itself only
 * stores variant_id/location_id/unit_id foreign keys. Location display is
 * deliberately simplified to code/name only, not a full ancestor breadcrumb —
 * a disclosed simplification vs. the prototype's getLocationFullPath, since
 * this app has no ready-made full-path helper.
 *
 * Shared by the guided-count, variance-review, and final-report SSR pages so
 * the enrichment logic (and its simplifications) live in exactly one place.
 */
export interface EnrichedCountLine extends CountLineRow {
  sku: string;
  productName: string;
  unitCode: string;
  locationCode: string;
  locationName: string;
}

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
