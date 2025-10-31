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

    // Step 1a: Get stock inventory data for products without variants
    const { data: nonVariantData, error: nonVariantError } = await supabase
      .from("stock_inventory")
      .select(
        "product_id, variant_id, location_id, organization_id, branch_id, available_quantity, reserved_quantity, total_value, average_cost, last_movement_at"
      )
      .eq("location_id", locationId)
      .eq("organization_id", organizationId)
      .is("variant_id", null)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });

    // Step 1b: Get stock inventory data for products with variants
    const { data: variantData, error: variantError } = await supabase
      .from("stock_inventory")
      .select(
        "product_id, variant_id, location_id, organization_id, branch_id, available_quantity, reserved_quantity, total_value, average_cost, last_movement_at"
      )
      .eq("location_id", locationId)
      .eq("organization_id", organizationId)
      .not("variant_id", "is", null)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });

    // Combine both datasets
    const inventoryData = [...(nonVariantData || []), ...(variantData || [])];
    const inventoryError = nonVariantError || variantError;

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError);
      return { data: [], error: inventoryError.message };
    }

    if (!inventoryData || inventoryData.length === 0) {
      return { data: [], error: null };
    }

    // Debug: Log raw inventory data to see variant_id values
    console.log("Raw inventory data sample:", inventoryData[0]);
    console.log(
      "Variant IDs in data:",
      inventoryData.map((item) => ({
        variant_id: item.variant_id,
        type: typeof item.variant_id,
      }))
    );

    // Step 2: Get unique product IDs and variant IDs
    const productIds = [...new Set(inventoryData.map((item) => item.product_id))];

    // Filter out null, undefined, and string "null" values
    const variantIds = inventoryData
      .map((item) => item.variant_id)
      .filter((id): id is string => {
        return id !== null && id !== undefined && id !== "null" && id.trim() !== "";
      });

    console.log("Filtered variant IDs:", variantIds);

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
      // Double-check all IDs are valid UUIDs
      const validVariantIds = [...new Set(variantIds)].filter((id) => {
        // Basic UUID format check
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(id);
      });

      if (validVariantIds.length > 0) {
        const { data: variantsData, error: variantsError } = await supabase
          .from("product_variants")
          .select("id, name, sku")
          .in("id", validVariantIds);

        if (variantsError) {
          console.error("Error fetching variants:", variantsError);
        } else {
          variants = variantsData || [];
        }
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
    console.error("Full error details:", JSON.stringify(err, null, 2));
    return {
      data: [],
      error: err instanceof Error ? err.message : "Failed to fetch location products",
    };
  }
}
