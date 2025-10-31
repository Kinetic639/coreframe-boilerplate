"use server";

import { createClient } from "@/utils/supabase/server";

export interface LocationProduct {
  product_id: string;
  variant_id: string | null;
  available_quantity: number;
  reserved_quantity: number;
  total_value: number;
  average_cost: number;
  last_movement_at: string;
  product: {
    id: string;
    name: string;
    sku: string;
    product_type: string;
    unit: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
}

export async function getLocationProducts(
  locationId: string,
  organizationId: string
): Promise<{ data: LocationProduct[]; error: string | null }> {
  try {
    const supabase = await createClient();

    // Step 1: Get stock inventory data
    const { data: inventoryData, error: inventoryError } = await supabase
      .from("stock_inventory")
      .select("*")
      .eq("location_id", locationId)
      .eq("organization_id", organizationId)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError);
      return { data: [], error: inventoryError.message };
    }

    if (!inventoryData || inventoryData.length === 0) {
      return { data: [], error: null };
    }

    // Step 2: Get unique product IDs and variant IDs
    const productIds = [...new Set(inventoryData.map((item) => item.product_id))];
    const variantIds = inventoryData
      .map((item) => item.variant_id)
      .filter((id): id is string => id !== null);

    // Step 3: Fetch products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku, product_type, unit")
      .in("id", productIds);

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return { data: [], error: productsError.message };
    }

    // Step 4: Fetch variants (if any)
    let variants: any[] = [];
    if (variantIds.length > 0) {
      const { data: variantsData, error: variantsError } = await supabase
        .from("product_variants")
        .select("id, name, sku")
        .in("id", variantIds);

      if (variantsError) {
        console.error("Error fetching variants:", variantsError);
      } else {
        variants = variantsData || [];
      }
    }

    // Step 5: Combine data
    const productsMap = new Map(products?.map((p) => [p.id, p]) || []);
    const variantsMap = new Map(variants.map((v) => [v.id, v]));

    const result: LocationProduct[] = inventoryData.map((item) => ({
      product_id: item.product_id,
      variant_id: item.variant_id,
      available_quantity: item.available_quantity || 0,
      reserved_quantity: item.reserved_quantity || 0,
      total_value: item.total_value || 0,
      average_cost: item.average_cost || 0,
      last_movement_at: item.last_movement_at,
      product: productsMap.get(item.product_id) || {
        id: item.product_id,
        name: "Unknown",
        sku: "",
        product_type: "goods",
        unit: "pcs",
      },
      variant: item.variant_id ? variantsMap.get(item.variant_id) : undefined,
    }));

    return { data: result, error: null };
  } catch (err) {
    console.error("Error in getLocationProducts:", err);
    return {
      data: [],
      error: err instanceof Error ? err.message : "Failed to fetch location products",
    };
  }
}
