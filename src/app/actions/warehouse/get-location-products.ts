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

    const { data, error } = await supabase
      .from("stock_inventory")
      .select(
        `
        product_id,
        variant_id,
        available_quantity,
        reserved_quantity,
        total_value,
        average_cost,
        last_movement_at,
        product:products!inner(id, name, sku, product_type, unit),
        variant:product_variants(id, name, sku)
      `
      )
      .eq("location_id", locationId)
      .eq("organization_id", organizationId)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });

    if (error) {
      console.error("Error fetching location products:", error);
      return { data: [], error: error.message };
    }

    return { data: (data as unknown as LocationProduct[]) || [], error: null };
  } catch (err) {
    console.error("Error in getLocationProducts:", err);
    return {
      data: [],
      error: err instanceof Error ? err.message : "Failed to fetch location products",
    };
  }
}
