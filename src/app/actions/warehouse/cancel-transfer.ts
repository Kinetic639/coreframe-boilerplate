"use server";

import { createClient } from "@/utils/supabase/server";

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

    const service = new InterWarehouseTransferService();
    const result = await service.cancelTransfer(transferId, user.id, reason);

    return result;
  } catch (error) {
    console.error("Error in cancelTransfer action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
