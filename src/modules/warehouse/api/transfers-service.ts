// =============================================
// Transfer Requests Service
// Complete CRUD and workflow operations for warehouse transfers
// =============================================

import { createClient } from "@/utils/supabase/client";
import type {
  TransferRequest,
  TransferRequestWithDetails,
  CreateTransferRequestInput,
  UpdateTransferRequestInput,
  ApproveTransferInput,
  ShipTransferInput,
  ReceiveTransferInput,
  TransferFilters,
  TransferStats,
  TransferStatus,
} from "../types/transfers";

export class TransfersService {
  /**
   * Create a new transfer request
   */
  async createTransferRequest(
    input: CreateTransferRequestInput,
    userId: string
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      // Validate that branches are different for inter-branch transfers
      if (input.from_branch_id === input.to_branch_id) {
        return {
          data: null,
          error: "Source and destination branches must be different for transfers",
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
          carrier: input.carrier || null,
          notes: input.notes || null,
          requested_by: userId,
          requires_confirmation: true,
          metadata: {},
        })
        .select()
        .single();

      if (transferError || !transfer) {
        console.error("Error creating transfer request:", transferError);
        return {
          data: null,
          error: transferError?.message || "Failed to create transfer request",
        };
      }

      // Create transfer items
      const itemsToInsert = input.items.map((item) => ({
        transfer_request_id: transfer.id,
        product_id: item.product_id,
        variant_id: item.variant_id || null,
        quantity: item.quantity,
        received_quantity: 0,
        from_location_id: item.from_location_id || null,
        to_location_id: item.to_location_id || null,
        item_status: "pending",
        item_notes: item.item_notes || null,
      }));

      const { error: itemsError } = await supabase
        .from("transfer_request_items")
        .insert(itemsToInsert);

      if (itemsError) {
        // Rollback: delete the transfer request
        await supabase.from("transfer_requests").delete().eq("id", transfer.id);
        console.error("Error creating transfer items:", itemsError);
        return {
          data: null,
          error: itemsError.message || "Failed to create transfer items",
        };
      }

      return { data: transfer, error: null };
    } catch (err) {
      console.error("Error in createTransferRequest:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Get transfer request by ID with full details
   */
  async getTransferRequest(
    transferId: string
  ): Promise<{ data: TransferRequestWithDetails | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data: transfer, error: transferError } = await supabase
        .from("transfer_requests")
        .select(
          `
          *,
          from_branch:branches!transfer_requests_from_branch_id_fkey(id, name),
          to_branch:branches!transfer_requests_to_branch_id_fkey(id, name),
          requested_by_user:users!transfer_requests_requested_by_fkey(id, email, full_name),
          approved_by_user:users!transfer_requests_approved_by_fkey(id, email, full_name)
        `
        )
        .eq("id", transferId)
        .single();

      if (transferError || !transfer) {
        return {
          data: null,
          error: transferError?.message || "Transfer request not found",
        };
      }

      // Get transfer items with details
      const { data: items, error: itemsError } = await supabase
        .from("transfer_request_items")
        .select(
          `
          *,
          product:products!transfer_request_items_product_id_fkey(id, name, sku, unit, track_inventory),
          variant:product_variants!transfer_request_items_variant_id_fkey(id, name, sku),
          from_location:locations!transfer_request_items_from_location_id_fkey(id, name, code),
          to_location:locations!transfer_request_items_to_location_id_fkey(id, name, code)
        `
        )
        .eq("transfer_request_id", transferId);

      if (itemsError) {
        return {
          data: null,
          error: itemsError.message || "Failed to load transfer items",
        };
      }

      return {
        data: {
          ...transfer,
          items: items || [],
        } as TransferRequestWithDetails,
        error: null,
      };
    } catch (err) {
      console.error("Error in getTransferRequest:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * List transfer requests with filters
   */
  async listTransferRequests(
    organizationId: string,
    branchId?: string,
    filters?: TransferFilters
  ): Promise<{ data: TransferRequestWithDetails[]; error: string | null }> {
    try {
      const supabase = createClient();

      let query = supabase
        .from("transfer_requests")
        .select(
          `
          *,
          from_branch:branches!transfer_requests_from_branch_id_fkey(id, name),
          to_branch:branches!transfer_requests_to_branch_id_fkey(id, name),
          requested_by_user:users!transfer_requests_requested_by_fkey(id, email, full_name)
        `
        )
        .eq("organization_id", organizationId);

      // Filter by branch (either from or to)
      if (branchId) {
        query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
      }

      // Apply filters
      if (filters?.status) {
        if (Array.isArray(filters.status)) {
          query = query.in("status", filters.status);
        } else {
          query = query.eq("status", filters.status);
        }
      }

      if (filters?.priority) {
        query = query.eq("priority", filters.priority);
      }

      if (filters?.from_branch_id) {
        query = query.eq("from_branch_id", filters.from_branch_id);
      }

      if (filters?.to_branch_id) {
        query = query.eq("to_branch_id", filters.to_branch_id);
      }

      if (filters?.expected_date_from) {
        query = query.gte("expected_date", filters.expected_date_from);
      }

      if (filters?.expected_date_to) {
        query = query.lte("expected_date", filters.expected_date_to);
      }

      if (filters?.search) {
        query = query.or(
          `transfer_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
        );
      }

      query = query.order("created_at", { ascending: false });

      const { data: transfers, error: transfersError } = await query;

      if (transfersError) {
        return {
          data: [],
          error: transfersError.message || "Failed to load transfers",
        };
      }

      // Get items count for each transfer
      const transfersWithItems = await Promise.all(
        (transfers || []).map(async (transfer) => {
          const { data: items } = await supabase
            .from("transfer_request_items")
            .select("*, product:products(id, name, sku, unit)")
            .eq("transfer_request_id", transfer.id);

          return {
            ...transfer,
            items: items || [],
          } as TransferRequestWithDetails;
        })
      );

      return { data: transfersWithItems, error: null };
    } catch (err) {
      console.error("Error in listTransferRequests:", err);
      return {
        data: [],
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Update transfer request
   */
  async updateTransferRequest(
    transferId: string,
    input: UpdateTransferRequestInput
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("transfer_requests")
        .update({
          priority: input.priority,
          expected_date: input.expected_date,
          shipping_method: input.shipping_method,
          carrier: input.carrier,
          tracking_number: input.tracking_number,
          notes: input.notes,
        })
        .eq("id", transferId)
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to update transfer request",
        };
      }

      return { data, error: null };
    } catch (err) {
      console.error("Error in updateTransferRequest:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Submit transfer for approval (draft → pending)
   */
  async submitTransfer(
    transferId: string
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("transfer_requests")
        .update({ status: "pending" })
        .eq("id", transferId)
        .eq("status", "draft")
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to submit transfer",
        };
      }

      return { data, error: null };
    } catch (err) {
      console.error("Error in submitTransfer:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Approve transfer (pending → approved)
   */
  async approveTransfer(
    transferId: string,
    input: ApproveTransferInput
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("transfer_requests")
        .update({
          status: "approved",
          approved_by: input.approved_by,
          approved_at: new Date().toISOString(),
          notes: input.notes || undefined,
        })
        .eq("id", transferId)
        .eq("status", "pending")
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to approve transfer",
        };
      }

      // TODO: Create stock reservations for approved items

      return { data, error: null };
    } catch (err) {
      console.error("Error in approveTransfer:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Reject transfer (pending → rejected)
   */
  async rejectTransfer(
    transferId: string,
    userId: string,
    reason: string
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("transfer_requests")
        .update({
          status: "rejected",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          notes: reason,
        })
        .eq("id", transferId)
        .eq("status", "pending")
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to reject transfer",
        };
      }

      return { data, error: null };
    } catch (err) {
      console.error("Error in rejectTransfer:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Ship transfer (approved → in_transit)
   */
  async shipTransfer(
    transferId: string,
    input: ShipTransferInput
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("transfer_requests")
        .update({
          status: "in_transit",
          shipped_by: input.shipped_by,
          shipped_at: new Date().toISOString(),
          shipping_method: input.shipping_method || undefined,
          carrier: input.carrier || undefined,
          tracking_number: input.tracking_number || undefined,
          notes: input.notes || undefined,
        })
        .eq("id", transferId)
        .eq("status", "approved")
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to ship transfer",
        };
      }

      // TODO: Create OUT movements (301/311) for source location

      return { data, error: null };
    } catch (err) {
      console.error("Error in shipTransfer:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Receive transfer (in_transit → completed)
   */
  async receiveTransfer(
    transferId: string,
    input: ReceiveTransferInput
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      // Update transfer status
      const { data: transfer, error: transferError } = await supabase
        .from("transfer_requests")
        .update({
          status: "completed",
          received_by: input.received_by,
          received_at: new Date().toISOString(),
          notes: input.notes || undefined,
        })
        .eq("id", transferId)
        .eq("status", "in_transit")
        .select()
        .single();

      if (transferError) {
        return {
          data: null,
          error: transferError.message || "Failed to receive transfer",
        };
      }

      // Update items with received quantities
      for (const item of input.items) {
        const { error: itemError } = await supabase
          .from("transfer_request_items")
          .update({
            received_quantity: item.received_quantity,
            item_status: "completed",
            to_location_id: item.to_location_id || undefined,
            item_notes: item.notes || undefined,
          })
          .eq("id", item.item_id);

        if (itemError) {
          console.error("Error updating item:", itemError);
        }
      }

      // TODO: Create IN movements (302/312) for destination location
      // TODO: Release stock reservations

      return { data: transfer, error: null };
    } catch (err) {
      console.error("Error in receiveTransfer:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Cancel transfer
   */
  async cancelTransfer(
    transferId: string,
    userId: string,
    reason: string
  ): Promise<{ data: TransferRequest | null; error: string | null }> {
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from("transfer_requests")
        .update({
          status: "cancelled",
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          notes: reason,
        })
        .eq("id", transferId)
        .in("status", ["draft", "pending", "approved"])
        .select()
        .single();

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to cancel transfer",
        };
      }

      // TODO: Release any stock reservations

      return { data, error: null };
    } catch (err) {
      console.error("Error in cancelTransfer:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Get transfer statistics
   */
  async getTransferStats(
    organizationId: string,
    branchId?: string
  ): Promise<{ data: TransferStats | null; error: string | null }> {
    try {
      const supabase = createClient();

      let query = supabase
        .from("transfer_requests")
        .select("status, priority, expected_date")
        .eq("organization_id", organizationId);

      if (branchId) {
        query = query.or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`);
      }

      const { data: transfers, error } = await query;

      if (error) {
        return {
          data: null,
          error: error.message || "Failed to load transfer stats",
        };
      }

      const stats: TransferStats = {
        total: transfers?.length || 0,
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
        overdue: 0,
      };

      const today = new Date().toISOString().split("T")[0];

      transfers?.forEach((transfer) => {
        stats.by_status[transfer.status as TransferStatus]++;
        stats.by_priority[transfer.priority as "normal" | "high" | "urgent"]++;

        if (transfer.status === "pending") stats.pending_approval++;
        if (transfer.status === "in_transit") stats.in_transit++;

        if (
          transfer.expected_date &&
          transfer.expected_date < today &&
          !["completed", "cancelled", "rejected"].includes(transfer.status)
        ) {
          stats.overdue++;
        }
      });

      return { data: stats, error: null };
    } catch (err) {
      console.error("Error in getTransferStats:", err);
      return {
        data: null,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      };
    }
  }
}

export const transfersService = new TransfersService();
