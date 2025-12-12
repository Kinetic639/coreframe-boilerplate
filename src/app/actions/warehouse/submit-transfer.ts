"use server";

import { createClient } from "@/utils/supabase/server";
import { InterWarehouseTransferService } from "@/modules/warehouse/api/inter-warehouse-transfer-service";

export async function submitTransfer(transferId: string) {
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
        error: "Unauthorized",
      };
    }

    const service = new InterWarehouseTransferService();
    const result = await service.submitTransfer(transferId);

    return result;
  } catch (error) {
    console.error("Error in submitTransfer action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
