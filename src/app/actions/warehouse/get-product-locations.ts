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

    // Step 1: Get stock inventory data
    const { data: inventoryData, error: inventoryError } = await supabase
      .from("stock_inventory")
      .select("*")
      .eq("product_id", productId)
      .eq("organization_id", organizationId)
      .gt("available_quantity", 0)
      .order("available_quantity", { ascending: false });

    if (inventoryError) {
      console.error("Error fetching inventory:", inventoryError);
      return { data: [], error: inventoryError.message, totalQuantity: 0 };
    }

    if (!inventoryData || inventoryData.length === 0) {
      return { data: [], error: null, totalQuantity: 0 };
    }

    // Step 2: Get unique location IDs
    const locationIds = [...new Set(inventoryData.map((item) => item.location_id))];

    // Step 3: Fetch locations
    const { data: locations, error: locationsError } = await supabase
      .from("locations")
      .select("id, name, code, icon_name, color")
      .in("id", locationIds);

    if (locationsError) {
      console.error("Error fetching locations:", locationsError);
      return { data: [], error: locationsError.message, totalQuantity: 0 };
    }

    // Step 4: Combine data
    const locationsMap = new Map(locations?.map((loc) => [loc.id, loc]) || []);

    const result: ProductLocation[] = inventoryData.map((item) => ({
      location_id: item.location_id,
      available_quantity: item.available_quantity || 0,
      reserved_quantity: item.reserved_quantity || 0,
      total_value: item.total_value || 0,
      average_cost: item.average_cost || 0,
      location: locationsMap.get(item.location_id) || {
        id: item.location_id,
        name: "Unknown",
        code: "",
        icon_name: "MapPin",
        color: "#6b7280",
      },
    }));

    const totalQuantity = result.reduce((sum, loc) => sum + loc.available_quantity, 0);

    return { data: result, error: null, totalQuantity };
  } catch (err) {
    console.error("Error in getProductLocations:", err);
    return {
      data: [],
      error: err instanceof Error ? err.message : "Failed to fetch product locations",
      totalQuantity: 0,
    };
  }
}
