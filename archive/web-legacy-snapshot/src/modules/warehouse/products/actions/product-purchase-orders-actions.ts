/**
 * Product Purchase Orders Actions
 * Server actions for fetching purchase orders containing a specific product
 */

"use server";

import { createClient } from "@supabase/server";

export async function getProductPurchaseOrdersAction(
  productId: string,
  organizationId: string
): Promise<{
  success: boolean;
  data?: any[];
  error?: string;
}> {
  try {
    const supabase = await createClient();

    // Fetch purchase orders that contain this product
    // Join purchase_order_items with purchase_orders
    const { data, error } = await supabase
      .from("purchase_order_items")
      .select(
        `
        quantity_ordered,
        quantity_received,
        quantity_pending,
        unit_price,
        line_total,
        purchase_order:purchase_orders!purchase_order_id (
          id,
          po_number,
          po_date,
          expected_delivery_date,
          status,
          supplier_id,
          supplier_name,
          total_amount,
          currency_code,
          organization_id
        )
      `
      )
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("purchase_order(po_date)", { ascending: false });

    if (error) {
      console.error("Error fetching product purchase orders:", error);
      return {
        success: false,
        error: error.message,
      };
    }

    // Filter by organization and flatten the structure
    const filteredData = (data || [])
      .filter((item: any) => item.purchase_order?.organization_id === organizationId)
      .map((item: any) => ({
        ...item.purchase_order,
        item_quantity_ordered: item.quantity_ordered,
        item_quantity_received: item.quantity_received,
        item_quantity_pending: item.quantity_pending,
        item_unit_price: item.unit_price,
        item_line_total: item.line_total,
      }));

    return {
      success: true,
      data: filteredData,
    };
  } catch (error) {
    console.error("Error in getProductPurchaseOrdersAction:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch purchase orders",
    };
  }
}
