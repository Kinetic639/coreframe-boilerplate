"use server";

import { createClient } from "@/utils/supabase/server";
import { InterWarehouseTransferService } from "@/modules/warehouse/api/inter-warehouse-transfer-service";

export async function getTransferRequest(transferId: string) {
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
        transfer: null,
        error: "Unauthorized",
      };
    }

    const service = new InterWarehouseTransferService();
    const transfer = await service.getTransferRequest(transferId);

    if (!transfer) {
      return {
        success: false,
        transfer: null,
        error: "Transfer not found",
      };
    }

    return {
      success: true,
      transfer,
    };
  } catch (error) {
    console.error("Error in getTransferRequest action:", error);
    return {
      success: false,
      transfer: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
