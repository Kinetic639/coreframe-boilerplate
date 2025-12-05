"use server";

import { createClient } from "@/utils/supabase/server";
import type { TransferFilters } from "@/modules/warehouse/types/inter-warehouse-transfers";

export async function getTransferRequests(
  organizationId: string,
  branchId?: string,
  filters?: TransferFilters
) {
  try {
    const supabase = await createClient();

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        data: [],
        error: "Unauthorized",
      };
    }

    const service = new InterWarehouseTransferService();
    const transfers = await service.listTransferRequests(organizationId, branchId, filters);

    return {
      success: true,
      data: transfers,
    };
  } catch (error) {
    console.error("Error in getTransferRequests action:", error);
    return {
      success: false,
      data: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
