"use server";

// =============================================
// Create Sales Order Server Action
// Handles server-side order creation with authentication
// =============================================

import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import type { SalesOrderFormData } from "@/modules/warehouse/types/sales-orders";

export async function createSalesOrder(data: SalesOrderFormData) {
  try {
    // Get current user
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

    // Load app context (organization/branch)
    const context = await loadAppContextServer();
    if (!context?.activeOrg) {
      return {
        success: false,
        error: "Organization context required",
      };
    }

    // Create order
    const result = await salesOrdersService.createSalesOrder(
      data,
      context.activeOrg.organization_id,
      context.activeBranch?.branch_id || null,
      user.id
    );

    return result;
  } catch (error) {
    console.error("Error in createSalesOrder action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
