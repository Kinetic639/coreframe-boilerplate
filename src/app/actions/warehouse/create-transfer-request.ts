"use server";

import { createClient } from "@/utils/supabase/server";
import { InterWarehouseTransfersService } from "@/server/services/inter-warehouse-transfers.service";
import type { CreateTransferRequestInput } from "@/modules/warehouse/types/inter-warehouse-transfers";

export async function createTransferRequest(input: CreateTransferRequestInput) {
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

    // Create transfer using service
    const result = await InterWarehouseTransfersService.createTransferRequest(
      supabase,
      input,
      user.id
    );

    return result;
  } catch (error) {
    console.error("Error in createTransferRequest action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
