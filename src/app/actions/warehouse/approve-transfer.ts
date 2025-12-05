"use server";

import { createClient } from "@/utils/supabase/server";
import { InterWarehouseTransferService } from "@/modules/warehouse/api/inter-warehouse-transfer-service";
import type { ApproveTransferInput } from "@/modules/warehouse/types/inter-warehouse-transfers";

export async function approveTransfer(transferId: string, input: ApproveTransferInput) {
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

    // TODO: Check if user has permission to approve transfers
    // await checkPermission(user.id, 'warehouse.transfers.approve');

    const service = new InterWarehouseTransferService();
    const result = await service.approveTransfer(transferId, input, user.id);

    return result;
  } catch (error) {
    console.error("Error in approveTransfer action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
