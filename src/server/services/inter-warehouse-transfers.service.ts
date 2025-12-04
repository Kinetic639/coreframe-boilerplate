import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateTransferRequestInput,
  ApproveTransferInput,
  ShipTransferInput,
  ReceiveTransferInput,
  TransferFilters,
  TransferStatus,
  TransferPriority,
} from "@/server/schemas/inter-warehouse-transfers.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type TransferRequest = Database["public"]["Tables"]["transfer_requests"]["Row"];
type TransferRequestItem = Database["public"]["Tables"]["transfer_request_items"]["Row"];

export interface TransferRequestWithItems extends TransferRequest {
  items: TransferRequestItem[];
  from_branch?: { id: string; name: string };
  to_branch?: { id: string; name: string };
}

export interface TransferStats {
  total: number;
  by_status: Record<TransferStatus, number>;
  by_priority: Record<TransferPriority, number>;
  pending_approval: number;
  in_transit: number;
}

export interface CreateTransferResult {
  success: boolean;
  transfer_id?: string;
  error?: string;
}

export interface TransferActionResult {
  success: boolean;
  movement_ids?: string[];
  error?: string;
}

// ==========================================
// INTER-WAREHOUSE TRANSFER SERVICE
// ==========================================

/**
 * Service for managing inter-warehouse transfer requests
 * Integrates with stock movements service to create actual movements (301-312)
 */
export class InterWarehouseTransfersService {
  /**
   * Create a new transfer request
   * Status: draft
   */
  static async createTransferRequest(
    supabase: SupabaseClient<Database>,
    input: CreateTransferRequestInput,
    userId: string
  ): Promise<CreateTransferResult> {
    try {
      // Validate branches are different
      if (input.from_branch_id === input.to_branch_id) {
        return {
          success: false,
          error: "Source and destination branches must be different",
        };
      }

      // Create transfer request
      const { data: transfer, error: transferError } = await supabase
        .from("transfer_requests")
        .insert({
          organization_id: input.organization_id,
          from_branch_id: input.from_branch_id,
          to_branch_id: input.to_branch_id,
          status: "draft",
          priority: input.priority || "normal",
          expected_date: input.expected_date || null,
          shipping_method: input.shipping_method || null,
          notes: input.notes || null,
          requested_by: userId,
          requires_confirmation: true,
        })
        .select()
        .single();

      if (transferError || !transfer) {
        return {
          success: false,
          error: transferError?.message || "Failed to create transfer request",
        };
      }

      // Create transfer items
      const itemsToInsert = input.items.map((item) => ({
        transfer_request_id: transfer.id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        product_variant_id: item.variant_id || item.product_id, // For compatibility
        quantity: item.quantity,
        unit_id: item.unit_id,
        from_location_id: item.from_location_id,
        to_location_id: item.to_location_id,
        item_status: "pending",
      }));

      const { error: itemsError } = await supabase
        .from("transfer_request_items")
        .insert(itemsToInsert as any);

      if (itemsError) {
        // Rollback: delete the transfer request
        await supabase.from("transfer_requests").delete().eq("id", transfer.id);

        return {
          success: false,
          error: itemsError.message,
        };
      }

      return {
        success: true,
        transfer_id: transfer.id,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get transfer request by ID with items and relations
   */
  static async getTransferRequest(
    supabase: SupabaseClient<Database>,
    transferId: string
  ): Promise<TransferRequestWithItems | null> {
    try {
      const { data: transfer, error: transferError } = await supabase
        .from("transfer_requests")
        .select(
          `
          *,
          from_branch:branches!transfer_requests_from_branch_id_fkey(id, name),
          to_branch:branches!transfer_requests_to_branch_id_fkey(id, name)
        `
        )
        .eq("id", transferId)
        .single();

      if (transferError || !transfer) {
        return null;
      }

      const { data: items } = await supabase
        .from("transfer_request_items")
        .select("*")
        .eq("transfer_request_id", transferId)
        .order("created_at");

      return {
        ...transfer,
        items: items || [],
      } as TransferRequestWithItems;
    } catch (error) {
      console.error("Error fetching transfer request:", error);
      return null;
    }
  }

  /**
   * List transfer requests with filters
   */
  static async listTransferRequests(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId?: string,
    filters?: TransferFilters
  ): Promise<TransferRequestWithItems[]> {
    try {
      let query = supabase
        .from("transfer_requests")
        .select(
          `
          *,
          from_branch:branches!transfer_requests_from_branch_id_fkey(id, name),
          to_branch:branches!transfer_requests_to_branch_id_fkey(id, name)
        `
        )
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });

      // Apply branch filter (from OR to)
      if (branchId) {
        query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
      }

      // Apply additional filters
      if (filters?.from_branch_id) {
        query = query.eq("from_branch_id", filters.from_branch_id);
      }
      if (filters?.to_branch_id) {
        query = query.eq("to_branch_id", filters.to_branch_id);
      }
      if (filters?.status) {
        query = query.eq("status", filters.status);
      }
      if (filters?.priority) {
        query = query.eq("priority", filters.priority);
      }
      if (filters?.date_from) {
        query = query.gte("created_at", filters.date_from);
      }
      if (filters?.date_to) {
        query = query.lte("created_at", filters.date_to);
      }

      const { data: transfers } = await query;

      if (!transfers) {
        return [];
      }

      // Fetch items for each transfer
      const transfersWithItems = await Promise.all(
        transfers.map(async (transfer) => {
          const { data: items } = await supabase
            .from("transfer_request_items")
            .select("*")
            .eq("transfer_request_id", transfer.id)
            .order("created_at");

          return {
            ...transfer,
            items: items || [],
          } as TransferRequestWithItems;
        })
      );

      return transfersWithItems;
    } catch (error) {
      console.error("Error fetching transfer with items request:", error);
      return null;
    }
  }

  /**
   * Submit transfer for approval
   * Status: draft → pending
   */
  static async submitTransfer(
    supabase: SupabaseClient<Database>,
    transferId: string
  ): Promise<TransferActionResult> {
    try {
      // TODO: Validate stock availability before submitting

      const { error } = await supabase
        .from("transfer_requests")
        .update({ status: "pending" })
        .eq("id", transferId)
        .eq("status", "draft");

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Approve transfer request
   * Status: pending → approved
   * Creates stock reservations for items
   */
  static async approveTransfer(
    supabase: SupabaseClient<Database>,
    transferId: string,
    input: ApproveTransferInput,
    userId: string
  ): Promise<TransferActionResult> {
    try {
      // Update transfer status
      const { error: updateError } = await supabase
        .from("transfer_requests")
        .update({
          status: "approved",
          approved_by: userId,
          approved_at: new Date().toISOString(),
          expected_date: input.expected_date || null,
          notes: input.notes || null,
        })
        .eq("id", transferId)
        .eq("status", "pending");

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // TODO: Create stock reservations for approved items
      // This prevents other operations from using the stock being transferred

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Ship transfer (mark as shipped)
   * Status: approved → in_transit
   * Creates OUT movements (301 for intra-org, 311 for inter-branch)
   *
   * NOTE: Stock movement creation is delegated to the stock movements service
   * through server actions to maintain separation of concerns
   */
  static async shipTransfer(
    supabase: SupabaseClient<Database>,
    transferId: string,
    input: ShipTransferInput,
    userId: string,
    movementIds: string[]
  ): Promise<TransferActionResult> {
    try {
      // Get transfer details
      const transfer = await this.getTransferRequest(supabase, transferId);
      if (!transfer) {
        return { success: false, error: "Transfer not found" };
      }

      if (transfer.status !== "approved") {
        return { success: false, error: "Transfer must be approved before shipping" };
      }

      // Update transfer status
      const { error: updateError } = await supabase
        .from("transfer_requests")
        .update({
          status: "in_transit",
          shipped_at: new Date().toISOString(),
          shipped_by: userId,
          carrier: input.carrier || null,
          tracking_number: input.tracking_number || null,
          shipping_method: input.shipping_method || null,
          notes: input.notes || transfer.notes,
        })
        .eq("id", transferId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // Update item statuses
      await supabase
        .from("transfer_request_items")
        .update({ item_status: "in_transit" })
        .eq("transfer_request_id", transferId);

      return { success: true, movement_ids: movementIds };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Receive transfer (complete transfer)
   * Status: in_transit → completed
   * Creates IN movements (302 for intra-org, 312 for inter-branch)
   * Releases stock reservations
   *
   * NOTE: Stock movement creation is delegated to the stock movements service
   * through server actions to maintain separation of concerns
   */
  static async receiveTransfer(
    supabase: SupabaseClient<Database>,
    transferId: string,
    input: ReceiveTransferInput,
    userId: string,
    movementIds: string[]
  ): Promise<TransferActionResult> {
    try {
      // Get transfer details
      const transfer = await this.getTransferRequest(supabase, transferId);
      if (!transfer) {
        return { success: false, error: "Transfer not found" };
      }

      if (transfer.status !== "in_transit") {
        return { success: false, error: "Transfer must be in transit to receive" };
      }

      // Update item received quantities
      for (const receivedItem of input.items) {
        await supabase
          .from("transfer_request_items")
          .update({
            received_quantity: receivedItem.received_quantity,
            item_status: "completed",
            item_notes: receivedItem.notes || null,
          })
          .eq("id", receivedItem.item_id);
      }

      // Update transfer status
      const { error: updateError } = await supabase
        .from("transfer_requests")
        .update({
          status: "completed",
          received_at: new Date().toISOString(),
          received_by: userId,
          notes: input.notes || transfer.notes,
        })
        .eq("id", transferId);

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      // TODO: Release stock reservations

      return { success: true, movement_ids: movementIds };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Cancel transfer
   * Can be cancelled at any stage before completion
   * Reverses any movements and releases reservations
   */
  static async cancelTransfer(
    supabase: SupabaseClient<Database>,
    transferId: string,
    reason: string
  ): Promise<TransferActionResult> {
    try {
      const transfer = await this.getTransferRequest(supabase, transferId);
      if (!transfer) {
        return { success: false, error: "Transfer not found" };
      }

      if (transfer.status === "completed") {
        return { success: false, error: "Cannot cancel completed transfer" };
      }

      // TODO: If in_transit, create reversal movements
      // TODO: Release any stock reservations

      const { error } = await supabase
        .from("transfer_requests")
        .update({
          status: "cancelled",
          notes: `${transfer.notes || ""}\n\nCancelled: ${reason}`.trim(),
        })
        .eq("id", transferId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get transfer statistics
   */
  static async getTransferStats(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId?: string
  ): Promise<TransferStats> {
    try {
      let query = supabase
        .from("transfer_requests")
        .select("status, priority")
        .eq("organization_id", organizationId);

      if (branchId) {
        query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
      }

      const { data } = await query;

      const stats: TransferStats = {
        total: data?.length || 0,
        by_status: {
          draft: 0,
          pending: 0,
          approved: 0,
          in_transit: 0,
          completed: 0,
          cancelled: 0,
          rejected: 0,
        },
        by_priority: {
          normal: 0,
          high: 0,
          urgent: 0,
        },
        pending_approval: 0,
        in_transit: 0,
      };

      if (data) {
        for (const transfer of data) {
          stats.by_status[transfer.status as TransferStatus]++;
          stats.by_priority[transfer.priority as TransferPriority]++;

          if (transfer.status === "pending") {
            stats.pending_approval++;
          }
          if (transfer.status === "in_transit") {
            stats.in_transit++;
          }
        }
      }

      return stats;
    } catch (error) {
      console.error("Error fetching transfer stats:", error);
      return {
        total: 0,
        by_status: {
          draft: 0,
          pending: 0,
          approved: 0,
          in_transit: 0,
          completed: 0,
          cancelled: 0,
          rejected: 0,
        },
        by_priority: { normal: 0, high: 0, urgent: 0 },
        pending_approval: 0,
        in_transit: 0,
      };
    }
  }
}
