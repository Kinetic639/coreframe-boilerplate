"use server";

import { createClient } from "@/utils/supabase/server";

export async function getProductsWithStock(branchId: string) {
  try {
    const supabase = await createClient();

    // Get all products first
    const { data: allProducts, error: productsError } = await supabase
      .from("products")
      .select("id, name, sku")
      .is("deleted_at", null)
      .order("name");

    if (productsError) {
      console.error("Error fetching products:", productsError);
      return {
        success: false,
        error: productsError.message,
        data: [],
      };
    }

    // Get stock levels for the branch
    const { data: stockData, error: stockError } = await supabase
      .from("product_location_stock")
      .select(
        `
        product_id,
        quantity,
        locations!inner (
          branch_id
        )
      `
      )
      .eq("locations.branch_id", branchId);

    if (stockError) {
      console.error("Error fetching stock:", stockError);
      return {
        success: false,
        error: stockError.message,
        data: [],
      };
    }

    // Aggregate stock by product_id
    const stockByProduct = (stockData || []).reduce((acc: any, stock: any) => {
      const productId = stock.product_id;
      if (!acc[productId]) {
        acc[productId] = 0;
      }
      acc[productId] += stock.quantity || 0;
      return acc;
    }, {});

    // Combine products with their stock levels
    const productsWithStock = (allProducts || [])
      .map((product: any) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        available_quantity: stockByProduct[product.id] || 0,
      }))
      .filter((p: any) => p.available_quantity > 0); // Only show products with stock

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
