"use server";

import { createClient } from "@/utils/supabase/server";
import type { ShipTransferInput } from "@/modules/warehouse/types/inter-warehouse-transfers";

export async function shipTransfer(transferId: string, input: ShipTransferInput) {
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

    // TODO: Check if user has permission to ship transfers
    // await checkPermission(user.id, 'warehouse.transfers.ship');

    const service = new InterWarehouseTransferService();
    const result = await service.shipTransfer(transferId, input, user.id);

    return result;
  } catch (error) {
    console.error("Error in shipTransfer action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
