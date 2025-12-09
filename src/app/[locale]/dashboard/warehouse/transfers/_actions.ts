"use server";

import { InterWarehouseTransfersService } from "@/server/services/inter-warehouse-transfers.service";
import { getUserContext } from "@/lib/utils/assert-auth";
import {
  createTransferRequestSchema,
  approveTransferSchema,
  shipTransferSchema,
  receiveTransferSchema,
  cancelTransferSchema,
  transferFiltersSchema,
  type CreateTransferRequestInput,
  type ApproveTransferInput,
  type ShipTransferInput,
  type ReceiveTransferInput,
  type CancelTransferInput,
  type TransferFilters,
} from "@/server/schemas/inter-warehouse-transfers.schema";

// ==========================================
// INTER-WAREHOUSE TRANSFER SERVER ACTIONS
// ==========================================

/**
 * Create a new transfer request
 */
export async function createTransferRequestAction(
  input: Omit<CreateTransferRequestInput, "organization_id">
) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "Organization context required" };
    }

    const validatedInput = createTransferRequestSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const result = await InterWarehouseTransfersService.createTransferRequest(
      supabase,
      validatedInput,
      user.id
    );

    if (!result.success) {
      return result;
    }

    return result;
  } catch (error) {
    console.error("[createTransferRequestAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create transfer request",
    };
  }
}

/**
 * Get a single transfer request by ID
 */
export async function getTransferRequestAction(transferId: string) {
  try {
    const { supabase } = await getUserContext();

    const transfer = await InterWarehouseTransfersService.getTransferRequest(supabase, transferId);

    if (!transfer) {
      return { success: false, error: "Transfer not found" };
    }

    return { success: true, data: transfer };
  } catch (error) {
    console.error("[getTransferRequestAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch transfer request",
    };
  }
}

/**
 * List transfer requests with filters
 */
export async function listTransferRequestsAction(branchId?: string, filters?: TransferFilters) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "Organization context required" };
    }

    const validatedFilters = filters ? transferFiltersSchema.parse(filters) : undefined;

    const transfers = await InterWarehouseTransfersService.listTransferRequests(
      supabase,
      organizationId,
      branchId,
      validatedFilters
    );

    return { success: true, data: transfers };
  } catch (error) {
    console.error("[listTransferRequestsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to list transfer requests",
    };
  }
}

/**
 * Submit transfer for approval
 */
export async function submitTransferAction(transferId: string) {
  try {
    const { supabase } = await getUserContext();

    const result = await InterWarehouseTransfersService.submitTransfer(supabase, transferId);

    if (!result.success) {
      return result;
    }

    return { success: true };
  } catch (error) {
    console.error("[submitTransferAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit transfer",
    };
  }
}

/**
 * Approve transfer request
 */
export async function approveTransferAction(transferId: string, input: ApproveTransferInput) {
  try {
    const { supabase, user } = await getUserContext();

    const validatedInput = approveTransferSchema.parse(input);

    const result = await InterWarehouseTransfersService.approveTransfer(
      supabase,
      transferId,
      validatedInput,
      user.id
    );

    if (!result.success) {
      return result;
    }

    return { success: true };
  } catch (error) {
    console.error("[approveTransferAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve transfer",
    };
  }
}

/**
 * Ship transfer (mark as shipped)
 * NOTE: Stock movements should be created separately before calling this
 */
export async function shipTransferAction(
  transferId: string,
  input: ShipTransferInput,
  movementIds: string[]
) {
  try {
    const { supabase, user } = await getUserContext();

    const validatedInput = shipTransferSchema.parse(input);

    const result = await InterWarehouseTransfersService.shipTransfer(
      supabase,
      transferId,
      validatedInput,
      user.id,
      movementIds
    );

    if (!result.success) {
      return result;
    }

    return result;
  } catch (error) {
    console.error("[shipTransferAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to ship transfer",
    };
  }
}

/**
 * Receive transfer (complete transfer)
 * NOTE: Stock movements should be created separately before calling this
 */
export async function receiveTransferAction(
  transferId: string,
  input: ReceiveTransferInput,
  movementIds: string[]
) {
  try {
    const { supabase, user } = await getUserContext();

    const validatedInput = receiveTransferSchema.parse(input);

    const result = await InterWarehouseTransfersService.receiveTransfer(
      supabase,
      transferId,
      validatedInput,
      user.id,
      movementIds
    );

    if (!result.success) {
      return result;
    }

    return result;
  } catch (error) {
    console.error("[receiveTransferAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to receive transfer",
    };
  }
}

/**
 * Cancel transfer
 */
export async function cancelTransferAction(transferId: string, input: CancelTransferInput) {
  try {
    const { supabase } = await getUserContext();

    const validatedInput = cancelTransferSchema.parse(input);

    const result = await InterWarehouseTransfersService.cancelTransfer(
      supabase,
      transferId,
      validatedInput.reason
    );

    if (!result.success) {
      return result;
    }

    return { success: true };
  } catch (error) {
    console.error("[cancelTransferAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel transfer",
    };
  }
}

/**
 * Get transfer statistics
 */
export async function getTransferStatsAction(branchId?: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "Organization context required" };
    }

    const stats = await InterWarehouseTransfersService.getTransferStats(
      supabase,
      organizationId,
      branchId
    );

    return { success: true, data: stats };
  } catch (error) {
    console.error("[getTransferStatsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch transfer statistics",
    };
  }
}
