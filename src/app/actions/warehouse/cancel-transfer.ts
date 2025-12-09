"use server";

import { createClient } from "@/utils/supabase/server";
import { InterWarehouseTransfersService } from "@/server/services/inter-warehouse-transfers.service";

export async function cancelTransfer(transferId: string, reason: string) {
  try {
    const supabase = await createClient();

    // Get current user
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

    const result = await InterWarehouseTransfersService.cancelTransfer(
      supabase,
      transferId,
      reason
    );

    return result;
  } catch (error) {
    console.error("Error in cancelTransfer action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
