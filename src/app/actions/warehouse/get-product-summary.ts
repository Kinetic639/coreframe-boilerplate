"use server";

import { createClient } from "@/utils/supabase/server";

export interface ProductSummary {
  quantity_on_hand: number;
  reserved_quantity: number;
  available_quantity: number;
}

export async function getProductSummary(
  productId: string,
  organizationId: string
): Promise<{ data: ProductSummary | null; error: string | null }> {
  try {
    const supabase = await createClient();

    // Get aggregated data from product_available_inventory view
    const { data: inventoryData, error: inventoryError } = await supabase
      .from("product_available_inventory")
      .select("quantity_on_hand, reserved_quantity, available_quantity")
      .eq("product_id", productId)
      .eq("organization_id", organizationId);

    if (inventoryError) {
      console.error("Error fetching product summary:", inventoryError);
      return { data: null, error: inventoryError.message };
    }

    if (!inventoryData || inventoryData.length === 0) {
      return {
        data: {
          quantity_on_hand: 0,
          reserved_quantity: 0,
          available_quantity: 0,
        },
        error: null,
      };
    }

    // Aggregate across all locations for this product
    const summary: ProductSummary = inventoryData.reduce(
      (acc, item) => ({
        quantity_on_hand: acc.quantity_on_hand + (item.quantity_on_hand || 0),
        reserved_quantity: acc.reserved_quantity + (item.reserved_quantity || 0),
        available_quantity: acc.available_quantity + (item.available_quantity || 0),
      }),
      {
        quantity_on_hand: 0,
        reserved_quantity: 0,
        available_quantity: 0,
      }
    );

    return { data: summary, error: null };
  } catch (err) {
    console.error("Error in getProductSummary:", err);
    return {
      data: null,
      error: err instanceof Error ? err.message : "Failed to fetch product summary",
    };
  }
}
