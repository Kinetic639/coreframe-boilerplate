"use server";

import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { SalesOrdersService } from "@/server/services/sales-orders.service";
import type { SalesOrderStatus } from "@/modules/warehouse/types/sales-orders";

export async function updateOrderStatus(
  orderId: string,
  newStatus: SalesOrderStatus,
  cancellationReason?: string
) {
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

    const result = await SalesOrdersService.updateOrderStatus(
      supabase,
      orderId,
      newStatus,
      context.activeOrg.organization_id,
      user.id,
      cancellationReason
    );

    return result;
  } catch (error) {
    console.error("Error in updateOrderStatus action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
