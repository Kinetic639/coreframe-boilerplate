"use server";

import { createClient } from "@/utils/supabase/server";
import type { ReceiveTransferInput } from "@/modules/warehouse/types/inter-warehouse-transfers";

export async function receiveTransfer(transferId: string, input: ReceiveTransferInput) {
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

    // TODO: Check if user has permission to receive transfers
    // await checkPermission(user.id, 'warehouse.transfers.receive');

    const service = new InterWarehouseTransferService();
    const result = await service.receiveTransfer(transferId, input, user.id);

    return result;
  } catch (error) {
    console.error("Error in receiveTransfer action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
