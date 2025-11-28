"use server";

import { createClient } from "@/utils/supabase/server";

export async function getProductsWithStock(branchId: string) {
  try {
    const supabase = await createClient();

    // Get products with their current stock levels
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        id,
        name,
        sku,
        product_location_stock!inner (
          quantity,
          location:locations!inner (
            branch_id
          )
        )
      `
      )
      .eq("product_location_stock.location.branch_id", branchId)
      .is("deleted_at", null)
      .order("name");

    if (error) {
      console.error("Error fetching products with stock:", error);
      return {
        success: false,
        error: error.message,
        data: [],
      };
    }

    // Aggregate stock quantities per product
    const productsWithStock = (data || []).map((product: any) => {
      const totalQuantity =
        product.product_location_stock?.reduce(
          (sum: number, stock: any) => sum + (stock.quantity || 0),
          0
        ) || 0;

      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        available_quantity: totalQuantity,
      };
    });

    return {
      success: true,
      data: productsWithStock,
    };
  } catch (error) {
    console.error("Error in getProductsWithStock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      data: [],
    };
  }
}
