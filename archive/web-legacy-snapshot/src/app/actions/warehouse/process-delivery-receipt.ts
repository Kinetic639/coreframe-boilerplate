/**
 * Server Action: Process Delivery Receipt
 *
 * Handles the receiving process when goods physically arrive.
 * Creates receipt document and associated stock movements.
 */

"use server";

import { createClient } from "@/utils/supabase/server";
import { ReceiptService } from "@/modules/warehouse/api/receipt-service";
import { ProcessDeliveryReceiptInput, ProcessReceiptResult } from "@/lib/types/receipt-documents";

export async function processDeliveryReceipt(
  input: ProcessDeliveryReceiptInput
): Promise<ProcessReceiptResult> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: "Unauthorized - user not found",
      };
    }

    // Create receipt service
    const receiptService = new ReceiptService(supabase);

    // Process the receipt
    const result = await receiptService.processDeliveryReceipt(input, user.id);

    return result;
  } catch (error) {
    console.error("Error in processDeliveryReceipt action:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process receipt",
    };
  }
}
