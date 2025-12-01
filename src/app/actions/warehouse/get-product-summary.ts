"use server";

import { createClient } from "@/lib/supabase/server";

export interface ProductSummary {
  quantity_on_hand: number;
  reserved_quantity: number;
  available_quantity: number;
  pending_po_quantity: number; // Qty to be received from approved POs
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

    // Get pending PO quantity using database function
    const { data: pendingPoData, error: pendingPoError } = await supabase.rpc(
      "get_pending_po_quantity",
      {
        p_product_id: productId,
        p_variant_id: null,
      }
    );

    if (pendingPoError) {
      console.error("Error fetching pending PO quantity:", pendingPoError);
    }

    const pendingPoQuantity = Number(pendingPoData) || 0;

    if (!inventoryData || inventoryData.length === 0) {
      return {
        data: {
          quantity_on_hand: 0,
          reserved_quantity: 0,
          available_quantity: 0,
          pending_po_quantity: pendingPoQuantity,
        },
        error: null,
      };
    }

    // Aggregate across all locations for this product
    const summary: ProductSummary = inventoryData.reduce<ProductSummary>(
      (acc, item) => ({
        quantity_on_hand: acc.quantity_on_hand + (item.quantity_on_hand || 0),
        reserved_quantity: acc.reserved_quantity + (item.reserved_quantity || 0),
        available_quantity: acc.available_quantity + (item.available_quantity || 0),
        pending_po_quantity: pendingPoQuantity,
      }),
      {
        quantity_on_hand: 0,
        reserved_quantity: 0,
        available_quantity: 0,
        pending_po_quantity: pendingPoQuantity,
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
