"use server";

import { createClient } from "@/utils/supabase/server";

export interface ProductLocation {
  location_id: string;
  available_quantity: number;
  reserved_quantity: number;
  total_value: number;
  average_cost: number;
  location: {
    id: string;
    name: string;
    code: string;
    icon_name: string;
    color: string;
  };
}

export async function getProductLocations(
  productId: string,
  organizationId: string
): Promise<{ data: ProductLocation[]; error: string | null; totalQuantity: number }> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("stock_inventory")
      .select(
        `
        location_id,
        available_quantity,
        reserved_quantity,
        total_value,
        average_cost,
        location:locations!inner(id, name, code, icon_name, color)
      `
      )
      .eq("product_id", productId)
      .eq("organization_id", organizationId)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });

    if (error) {
      console.error("Error fetching product locations:", error);
      return { data: [], error: error.message, totalQuantity: 0 };
    }

    const locations = (data as unknown as ProductLocation[]) || [];
    const totalQuantity = locations.reduce((sum, loc) => sum + loc.available_quantity, 0);

    return { data: locations, error: null, totalQuantity };
  } catch (err) {
    console.error("Error in getProductLocations:", err);
    return {
      data: [],
      error: err instanceof Error ? err.message : "Failed to fetch product locations",
      totalQuantity: 0,
    };
  }
}
