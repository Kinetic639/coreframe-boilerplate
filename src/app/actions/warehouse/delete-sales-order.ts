"use server";

import { createClient } from "@/utils/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

export async function deleteSalesOrder(orderId: string) {
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

    const result = await salesOrdersService.deleteSalesOrder(
      orderId,
      context.activeOrg.organization_id
    );

    return result;
  } catch (error) {
    console.error("Error in deleteSalesOrder action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "An unexpected error occurred",
    };
  }
}
