"use server";

import { salesOrdersService } from "@/modules/warehouse/api/sales-orders-service";
import { createClient } from "@/lib/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import type { SalesOrderFormData } from "@/modules/warehouse/types/sales-orders";

export async function updateSalesOrder(orderId: string, data: Partial<SalesOrderFormData>) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        error: "Authentication required",
      };
    }

    const context = await loadAppContextServer();
    if (!context?.activeOrg) {
      return {
        success: false,
        error: "Organization context required",
      };
    }

    const result = await salesOrdersService.updateSalesOrder(
      orderId,
      data,
      context.activeOrg.organization_id,
      user.id
    );

    return result;
  } catch (error) {
    console.error("Error in updateSalesOrder action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
