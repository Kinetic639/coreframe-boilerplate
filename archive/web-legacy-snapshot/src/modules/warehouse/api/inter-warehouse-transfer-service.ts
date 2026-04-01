// =============================================
// Inter-Warehouse Transfer Service
// Manages transfer requests and creates stock movements (codes 301-312)
// =============================================

import { createClient } from "@/utils/supabase/client";
import { StockMovementsService } from "./stock-movements-service";
import type { CreateStockMovementData } from "../types/stock-movements";

export type TransferStatus =
  | "draft"
  | "pending"
  | "approved"
  | "in_transit"
  | "completed"
  | "cancelled"
  | "rejected";

export type TransferPriority = "normal" | "high" | "urgent";

export interface TransferRequest {
  id: string;
  organization_id: string;
  from_branch_id: string;
  to_branch_id: string;
  transfer_number: string;
  status: TransferStatus;
  priority: TransferPriority;
  expected_date: string | null;
  shipped_at: string | null;
  received_at: string | null;
  shipping_method: string | null;
  carrier: string | null;
  tracking_number: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  shipped_by: string | null;
  received_by: string | null;
  notes: string | null;
  comment: string | null;
  requires_confirmation: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TransferRequestItem {
  id: string;
  transfer_request_id: string;
  product_id: string;
  variant_id: string | null;
  product_variant_id: string; // Legacy field
  quantity: number;
  received_quantity: number;
  unit_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  item_status: string;
  item_notes: string | null;
  comment: string | null;
  created_at: string;
}

export interface TransferRequestWithItems extends TransferRequest {
  items: TransferRequestItem[];
  from_branch?: { id: string; name: string };
  to_branch?: { id: string; name: string };
}

export interface CreateTransferRequestInput {
  organization_id: string;
  from_branch_id: string;
  to_branch_id: string;
  priority?: TransferPriority;
  expected_date?: string;
  shipping_method?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    unit_id: string;
    from_location_id: string;
    to_location_id: string;
  }>;
}

export interface ApproveTransferInput {
  expected_date?: string;
  notes?: string;
}

export interface ShipTransferInput {
  carrier?: string;
  tracking_number?: string;
  shipping_method?: string;
  notes?: string;
}

export interface ReceiveTransferInput {
  items: Array<{
    item_id: string;
    received_quantity: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface TransferFilters {
  organization_id?: string;
  from_branch_id?: string;
  to_branch_id?: string;
  status?: TransferStatus;
  priority?: TransferPriority;
  date_from?: string;
  date_to?: string;
}

export interface TransferStats {
  total: number;
  by_status: Record<TransferStatus, number>;
  by_priority: Record<TransferPriority, number>;
  pending_approval: number;
  in_transit: number;
}

/**
 * Service for managing inter-warehouse transfer requests
 * Integrates with stock movements service to create actual movements (301-312)
 */
export class InterWarehouseTransferService {
  private supabase = createClient();
  private movementsService = new StockMovementsService();

  /**
   * Create a new transfer request
   * Status: draft
   */
  async createTransferRequest(
    input: CreateTransferRequestInput,
    userId: string
  ): Promise<{ success: boolean; transfer_id?: string; error?: string }> {
    try {
      // Validate branches are different
      if (input.from_branch_id === input.to_branch_id) {
        return {
          success: false,
          error: "Source and destination branches must be different",
        };
      }

      // Create transfer request
      const { data: transfer, error: transferError } = await this.supabase
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

      const { error: itemsError } = await this.supabase
        .from("transfer_request_items")
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback: delete the transfer request
        await this.supabase.from("transfer_requests").delete().eq("id", transfer.id);

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
      console.error("Error creating transfer request:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get transfer request by ID with items and relations
   */
  async getTransferRequest(transferId: string): Promise<TransferRequestWithItems | null> {
    try {
      const { data: transfer, error: transferError } = await this.supabase
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

      const { data: items, error: itemsError } = await this.supabase
        .from("transfer_request_items")
        .select("*")
        .eq("transfer_request_id", transferId)
        .order("created_at");

      if (itemsError) {
        return null;
      }

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
  async listTransferRequests(
    organizationId: string,
    branchId?: string,
    filters?: TransferFilters
  ): Promise<TransferRequestWithItems[]> {
    try {
      let query = this.supabase
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

      const { data: transfers, error } = await query;

      if (error || !transfers) {
        return [];
      }

      // Fetch items for each transfer
      const transfersWithItems = await Promise.all(
        transfers.map(async (transfer) => {
          const { data: items } = await this.supabase
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
      console.error("Error listing transfer requests:", error);
      return [];
    }
  }

  /**
   * Submit transfer for approval
   * Status: draft → pending
   */
  async submitTransfer(transferId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // TODO: Validate stock availability before submitting

      const { error } = await this.supabase
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
  async approveTransfer(
    transferId: string,
    input: ApproveTransferInput,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Update transfer status
      const { error: updateError } = await this.supabase
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
   */
  async shipTransfer(
    transferId: string,
    input: ShipTransferInput,
    userId: string
  ): Promise<{ success: boolean; movement_ids?: string[]; error?: string }> {
    try {
      // Get transfer details
      const transfer = await this.getTransferRequest(transferId);
      if (!transfer) {
        return { success: false, error: "Transfer not found" };
      }

      if (transfer.status !== "approved") {
        return { success: false, error: "Transfer must be approved before shipping" };
      }

      // Determine movement type: 301 (intra-location) or 311 (inter-branch)
      const movementTypeCode = transfer.from_branch_id === transfer.to_branch_id ? "301" : "311";

      // Create OUT movements for each item
      const movementIds: string[] = [];

      for (const item of transfer.items) {
        const movementData: CreateStockMovementData = {
          movement_type_code: movementTypeCode,
          organization_id: transfer.organization_id,
          branch_id: transfer.from_branch_id,
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: item.quantity,
          source_location_id: item.from_location_id || undefined,
          reference_type: "transfer_request",
          reference_id: transfer.id,
          reference_number: transfer.transfer_number,
          notes: `Transfer ${transfer.transfer_number} - Shipped`,
          metadata: {
            transfer_request_id: transfer.id,
            transfer_item_id: item.id,
            destination_branch_id: transfer.to_branch_id,
            destination_location_id: item.to_location_id,
          },
        };

        const result = await this.movementsService.createMovement(movementData, userId);

        if (!result.success) {
          return { success: false, error: result.errors?.join(", ") };
        }

        if (result.movement_id) {
          movementIds.push(result.movement_id);
        }
      }

      // Update transfer status
      const { error: updateError } = await this.supabase
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
      await this.supabase
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
   */
  async receiveTransfer(
    transferId: string,
    input: ReceiveTransferInput,
    userId: string
  ): Promise<{ success: boolean; movement_ids?: string[]; error?: string }> {
    try {
      // Get transfer details
      const transfer = await this.getTransferRequest(transferId);
      if (!transfer) {
        return { success: false, error: "Transfer not found" };
      }

      if (transfer.status !== "in_transit") {
        return { success: false, error: "Transfer must be in transit to receive" };
      }

      // Determine movement type: 302 (intra-location) or 312 (inter-branch)
      const movementTypeCode = transfer.from_branch_id === transfer.to_branch_id ? "302" : "312";

      // Create IN movements for each received item
      const movementIds: string[] = [];

      for (const receivedItem of input.items) {
        const item = transfer.items.find((i) => i.id === receivedItem.item_id);
        if (!item) continue;

        const movementData: CreateStockMovementData = {
          movement_type_code: movementTypeCode,
          organization_id: transfer.organization_id,
          branch_id: transfer.to_branch_id,
          product_id: item.product_id,
          variant_id: item.variant_id || undefined,
          quantity: receivedItem.received_quantity,
          destination_location_id: item.to_location_id || undefined,
          reference_type: "transfer_request",
          reference_id: transfer.id,
          reference_number: transfer.transfer_number,
          notes: `Transfer ${transfer.transfer_number} - Received`,
          metadata: {
            transfer_request_id: transfer.id,
            transfer_item_id: item.id,
            source_branch_id: transfer.from_branch_id,
            source_location_id: item.from_location_id,
          },
        };

        const result = await this.movementsService.createMovement(movementData, userId);

        if (!result.success) {
          return { success: false, error: result.errors?.join(", ") };
        }

        if (result.movement_id) {
          movementIds.push(result.movement_id);
        }

        // Update item with received quantity
        await this.supabase
          .from("transfer_request_items")
          .update({
            received_quantity: receivedItem.received_quantity,
            item_status: "completed",
            item_notes: receivedItem.notes || null,
          })
          .eq("id", receivedItem.item_id);
      }

      // Update transfer status
      const { error: updateError } = await this.supabase
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
  async cancelTransfer(
    transferId: string,
    userId: string,
    reason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const transfer = await this.getTransferRequest(transferId);
      if (!transfer) {
        return { success: false, error: "Transfer not found" };
      }

      if (transfer.status === "completed") {
        return { success: false, error: "Cannot cancel completed transfer" };
      }

      // TODO: If in_transit, create reversal movements
      // TODO: Release any stock reservations

      const { error } = await this.supabase
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
  async getTransferStats(organizationId: string, branchId?: string): Promise<TransferStats> {
    try {
      let query = this.supabase
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
      console.error("Error getting transfer stats:", error);
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
