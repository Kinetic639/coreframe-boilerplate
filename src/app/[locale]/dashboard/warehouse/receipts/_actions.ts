/**
 * Receipt Server Actions
 * Next.js server actions for receipt document operations
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { ReceiptsService } from "@/server/services/receipts.service";
import {
  processDeliveryReceiptSchema,
  cancelReceiptSchema,
  receiptFiltersSchema,
  type ProcessDeliveryReceiptInput,
  type CancelReceiptInput,
  type ReceiptFiltersInput,
} from "@/server/schemas/receipts.schema";

// =====================================================
// QUERY ACTIONS
// =====================================================

/**
 * Get a single receipt by ID with all related data
 */
export async function getReceiptByIdAction(receiptId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    const receipt = await ReceiptsService.getReceiptById(supabase, receiptId, organizationId);

    if (!receipt) {
      return { success: false, error: "Receipt not found" };
    }

    return { success: true, data: receipt };
  } catch (error) {
    console.error("[getReceiptByIdAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch receipt",
    };
  }
}

/**
 * Get all receipts with optional filters
 */
export async function getReceiptsAction(filters: ReceiptFiltersInput = {}) {
  try {
    const { supabase, organizationId, branchId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    if (!branchId) {
      return { success: false, error: "No active branch found" };
    }

    // Validate filters
    const validatedFilters = receiptFiltersSchema.parse(filters);

    const result = await ReceiptsService.getReceipts(
      supabase,
      organizationId,
      branchId,
      validatedFilters
    );

    return {
      success: true,
      data: result.receipts,
      total: result.total,
    };
  } catch (error) {
    console.error("[getReceiptsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch receipts",
    };
  }
}

/**
 * Get partial receipt status for a delivery movement
 */
export async function getPartialReceiptStatusAction(deliveryMovementId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    const status = await ReceiptsService.getPartialReceiptStatus(
      supabase,
      deliveryMovementId,
      organizationId
    );

    return { success: true, data: status };
  } catch (error) {
    console.error("[getPartialReceiptStatusAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch partial receipt status",
    };
  }
}

// =====================================================
// MUTATION ACTIONS
// =====================================================

/**
 * Process a delivery receipt (create receipt document and update stock)
 */
export async function processDeliveryReceiptAction(input: ProcessDeliveryReceiptInput) {
  try {
    const { supabase, user, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    // Validate input
    const validatedInput = processDeliveryReceiptSchema.parse(input);

    const result = await ReceiptsService.processDeliveryReceipt(
      supabase,
      organizationId,
      validatedInput,
      user.id
    );

    return { success: true, data: result };
  } catch (error) {
    console.error("[processDeliveryReceiptAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process delivery receipt",
    };
  }
}

/**
 * Cancel a receipt document
 */
export async function cancelReceiptAction(receiptId: string, input: CancelReceiptInput) {
  try {
    const { supabase, user, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    if (!user?.id) {
      return { success: false, error: "User not authenticated" };
    }

    // Validate input
    const validatedInput = cancelReceiptSchema.parse(input);

    await ReceiptsService.cancelReceipt(
      supabase,
      receiptId,
      organizationId,
      validatedInput,
      user.id
    );

    return { success: true, data: { receiptId } };
  } catch (error) {
    console.error("[cancelReceiptAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel receipt",
    };
  }
}
