/**
 * Receipt Service
 *
 * Handles all receipt document operations following Solution B architecture:
 * - receipt_documents = metadata/compliance layer
 * - receipt_movements = linking receipts to movements
 * - stock_movements = quantitative truth
 *
 * Key Patterns:
 * 1. Parent/child movements for partial receipts
 * 2. Damage movements (type 206) for rejected goods
 * 3. PZ document generation on completion
 * 4. Status transitions: draft → completed
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/supabase";
import {
  ReceiptDocumentWithRelations,
  ReceiptFilters,
  ProcessDeliveryReceiptInput,
  ProcessReceiptResult,
  PartialReceiptStatus,
} from "@/lib/types/receipt-documents";

export class ReceiptService {
  constructor(private supabase: SupabaseClient<Database>) {}

  /**
   * Get receipt by ID with all related data
   */
  async getReceiptById(receiptId: string): Promise<ReceiptDocumentWithRelations | null> {
    try {
      // Fetch receipt document
      const { data: receipt, error: receiptError } = await this.supabase
        .from("receipt_documents")
        .select("*")
        .eq("id", receiptId)
        .single();

      if (receiptError) throw receiptError;
      if (!receipt) return null;

      // Fetch linked movements
      const { data: receiptMovements, error: movementsError } = await this.supabase
        .from("receipt_movements")
        .select("movement_id")
        .eq("receipt_id", receiptId);

      if (movementsError) throw movementsError;

      const movementIds = receiptMovements?.map((rm) => rm.movement_id) || [];

      let movements: any[] = [];
      if (movementIds.length > 0) {
        const { data: movementsData, error: movError } = await this.supabase
          .from("stock_movements")
          .select("*")
          .in("id", movementIds);

        if (movError) throw movError;
        movements = movementsData || [];
      }

      // Fetch user data
      const userIds = [receipt.created_by, receipt.received_by].filter(
        (id): id is string => id !== null
      );

      const usersMap = new Map();
      if (userIds.length > 0) {
        const { data: users } = await this.supabase
          .from("users")
          .select("id, email, first_name, last_name")
          .in("id", userIds);

        users?.forEach((user) => {
          usersMap.set(user.id, user);
        });
      }

      return {
        ...receipt,
        created_by_user: receipt.created_by ? usersMap.get(receipt.created_by) : null,
        received_by_user: receipt.received_by ? usersMap.get(receipt.received_by) : null,
        movements,
      };
    } catch (error) {
      console.error("Error fetching receipt:", error);
      throw error;
    }
  }

  /**
   * Get all receipts with filters
   */
  async getReceipts(filters: ReceiptFilters): Promise<ReceiptDocumentWithRelations[]> {
    try {
      let query = this.supabase
        .from("receipt_documents")
        .select("*")
        .eq("organization_id", filters.organization_id);

      if (filters.branch_id) {
        query = query.eq("branch_id", filters.branch_id);
      }

      if (filters.status) {
        query = query.eq("status", filters.status);
      }

      if (filters.receipt_type) {
        query = query.eq("receipt_type", filters.receipt_type);
      }

      if (filters.date_from) {
        query = query.gte("receipt_date", filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte("receipt_date", filters.date_to);
      }

      if (filters.received_by) {
        query = query.eq("received_by", filters.received_by);
      }

      if (filters.search) {
        query = query.or(
          `receipt_number.ilike.%${filters.search}%,pz_document_number.ilike.%${filters.search}%`
        );
      }

      if (filters.has_quality_issues !== undefined) {
        query = query.eq("quality_check_passed", !filters.has_quality_issues);
      }

      query = query.order("receipt_date", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as ReceiptDocumentWithRelations[];
    } catch (error) {
      console.error("Error fetching receipts:", error);
      throw error;
    }
  }

  /**
   * Process a delivery receipt
   *
   * This is the main function that:
   * 1. Creates receipt_document
   * 2. Creates stock_movements for received quantities
   * 3. Creates damage movements if needed
   * 4. Links movements to receipt via receipt_movements
   * 5. Updates original delivery status
   * 6. Generates PZ document
   */
  async processDeliveryReceipt(
    input: ProcessDeliveryReceiptInput,
    userId: string
  ): Promise<ProcessReceiptResult> {
    try {
      // Step 1: Fetch original delivery movement
      const { data: originalMovement, error: movementError } = await this.supabase
        .from("stock_movements")
        .select("*")
        .eq("id", input.delivery_movement_id)
        .single();

      if (movementError || !originalMovement) {
        return {
          success: false,
          error: "Original delivery movement not found",
        };
      }

      const movementsCreated: string[] = [];

      // Step 2: Generate receipt number
      const { data: receiptNumberData, error: numberError } = await this.supabase.rpc(
        "generate_receipt_number",
        {
          p_organization_id: originalMovement.organization_id,
          p_branch_id: originalMovement.branch_id,
        }
      );

      if (numberError || !receiptNumberData) {
        return {
          success: false,
          error: "Failed to generate receipt number",
        };
      }

      // Step 3: Create receipt document
      const receiptDate =
        input.receipt_date instanceof Date
          ? input.receipt_date.toISOString()
          : input.receipt_date || new Date().toISOString();

      const { data: receipt, error: receiptError } = await this.supabase
        .from("receipt_documents")
        .insert({
          receipt_number: receiptNumberData,
          organization_id: originalMovement.organization_id,
          branch_id: originalMovement.branch_id,
          receipt_type: input.receipt_type,
          receipt_date: receiptDate,
          created_by: userId,
          received_by: input.received_by || userId,
          quality_check_passed: input.quality_check_passed ?? true,
          quality_notes: input.quality_notes,
          receiving_notes: input.receiving_notes,
          status: "draft",
        })
        .select()
        .single();

      if (receiptError || !receipt) {
        return {
          success: false,
          error: "Failed to create receipt document",
        };
      }

      // Step 3: Process each line item
      for (const item of input.items) {
        const quantityAccepted = item.quantity_received - item.quantity_damaged;

        // Create movement for accepted quantity
        if (quantityAccepted > 0) {
          const { data: acceptedMovement, error: acceptedError } = await this.supabase
            .from("stock_movements")
            .insert({
              organization_id: originalMovement.organization_id,
              branch_id: originalMovement.branch_id,
              movement_type_code: originalMovement.movement_type_code, // Same type (101)
              category: originalMovement.category,
              product_id: item.product_id,
              variant_id: item.variant_id,
              quantity: quantityAccepted,
              unit_of_measure: item.unit,
              unit_cost: item.unit_cost,
              total_cost: item.unit_cost ? item.unit_cost * quantityAccepted : null,
              destination_location_id: item.destination_location_id,
              batch_number: item.batch_number,
              serial_number: item.serial_number,
              expiry_date:
                item.expiry_date instanceof Date
                  ? item.expiry_date.toISOString()
                  : item.expiry_date,
              status: "completed",
              created_by: userId,
              parent_movement_id: input.delivery_movement_id,
              reference_number: originalMovement.reference_number,
              notes: item.notes,
            })
            .select()
            .single();

          if (acceptedError || !acceptedMovement) {
            console.error("Failed to create accepted movement:", acceptedError);
            continue;
          }

          movementsCreated.push(acceptedMovement.id);

          // Link to receipt
          await this.supabase.from("receipt_movements").insert({
            receipt_id: receipt.id,
            movement_id: acceptedMovement.id,
          });
        }

        // Create damage movement if needed
        if (item.quantity_damaged > 0) {
          // Find damage movement type (206)
          const { data: damageType } = await this.supabase
            .from("movement_types")
            .select("code, category")
            .eq("code", "206")
            .single();

          if (damageType) {
            const { data: damageMovement } = await this.supabase
              .from("stock_movements")
              .insert({
                organization_id: originalMovement.organization_id,
                branch_id: originalMovement.branch_id,
                movement_type_code: damageType.code,
                category: damageType.category,
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity_damaged,
                unit_of_measure: item.unit,
                source_location_id: item.destination_location_id, // Same location
                status: "completed",
                created_by: userId,
                parent_movement_id: input.delivery_movement_id,
                reference_number: `DAMAGE-${originalMovement.reference_number}`,
                notes: `Damaged goods from receipt ${receipt.receipt_number}. Reason: ${item.damage_reason || "Unknown"}. ${item.damage_notes || ""}`,
              })
              .select()
              .single();

            if (damageMovement) {
              movementsCreated.push(damageMovement.id);
            }
          }
        }
      }

      // Step 4: Update receipt status to completed
      await this.supabase
        .from("receipt_documents")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", receipt.id);

      // Step 5: Update original delivery status
      const isPartialReceipt = input.receipt_type === "partial";
      const newStatus = isPartialReceipt ? "approved" : "completed";

      await this.supabase
        .from("stock_movements")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", input.delivery_movement_id);

      // Step 6: Generate PZ document (placeholder for now)
      // TODO: Implement actual PDF generation
      const pzDocumentUrl = await this.generatePZDocument(receipt.id);

      return {
        success: true,
        receipt_id: receipt.id,
        receipt_number: receipt.receipt_number,
        pz_document_url: pzDocumentUrl,
        movements_created: movementsCreated,
      };
    } catch (error) {
      console.error("Error processing delivery receipt:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process receipt",
      };
    }
  }

  /**
   * Get partial receipt status for a delivery
   */
  async getPartialReceiptStatus(deliveryMovementId: string): Promise<PartialReceiptStatus | null> {
    try {
      // Get original delivery
      const { data: delivery } = await this.supabase
        .from("stock_movements")
        .select("quantity")
        .eq("id", deliveryMovementId)
        .single();

      if (!delivery) return null;

      // Get all child movements (receipts)
      const { data: childMovements } = await this.supabase
        .from("stock_movements")
        .select("id, quantity")
        .eq("parent_movement_id", deliveryMovementId)
        .eq("status", "completed");

      const quantityReceived = childMovements?.reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;

      // Get associated receipts
      const movementIds = childMovements?.map((m) => m.id) || [];
      let receipts: any[] = [];

      if (movementIds.length > 0) {
        const { data: receiptMovements } = await this.supabase
          .from("receipt_movements")
          .select(
            `
            receipt_id,
            receipt_documents (
              id,
              receipt_number,
              receipt_date,
              status
            )
          `
          )
          .in("movement_id", movementIds);

        receipts =
          receiptMovements
            ?.map((rm: any) => ({
              receipt_id: rm.receipt_documents.id,
              receipt_number: rm.receipt_documents.receipt_number,
              receipt_date: rm.receipt_documents.receipt_date,
              status: rm.receipt_documents.status,
              quantity: 0, // TODO: Calculate from movements
            }))
            .filter(
              (r, index, self) => index === self.findIndex((t) => t.receipt_id === r.receipt_id)
            ) || [];
      }

      return {
        delivery_movement_id: deliveryMovementId,
        quantity_ordered: delivery.quantity || 0,
        quantity_received: quantityReceived,
        quantity_remaining: (delivery.quantity || 0) - quantityReceived,
        receipts,
        is_complete: quantityReceived >= (delivery.quantity || 0),
        can_receive_more: quantityReceived < (delivery.quantity || 0),
      };
    } catch (error) {
      console.error("Error getting partial receipt status:", error);
      return null;
    }
  }

  /**
   * Cancel a receipt
   */
  async cancelReceipt(receiptId: string, reason: string, userId: string): Promise<boolean> {
    try {
      // Update receipt status
      const { error: receiptError } = await this.supabase
        .from("receipt_documents")
        .update({
          status: "cancelled",
          receiving_notes: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", receiptId);

      if (receiptError) throw receiptError;

      // Cancel all linked movements
      const { data: receiptMovements } = await this.supabase
        .from("receipt_movements")
        .select("movement_id")
        .eq("receipt_id", receiptId);

      if (receiptMovements && receiptMovements.length > 0) {
        const movementIds = receiptMovements.map((rm) => rm.movement_id);

        await this.supabase
          .from("stock_movements")
          .update({
            status: "cancelled",
            cancelled_by: userId,
            cancelled_at: new Date().toISOString(),
            cancellation_reason: `Receipt cancelled: ${reason}`,
          })
          .in("id", movementIds);
      }

      return true;
    } catch (error) {
      console.error("Error cancelling receipt:", error);
      return false;
    }
  }

  /**
   * Generate PZ document (placeholder)
   * TODO: Implement actual PDF generation with puppeteer or react-pdf
   */
  private async generatePZDocument(receiptId: string): Promise<string | null> {
    // This is a placeholder
    // In production, this would:
    // 1. Fetch receipt details
    // 2. Render PZ template
    // 3. Generate PDF
    // 4. Upload to Supabase Storage
    // 5. Update receipt_documents.pz_document_url
    // 6. Return URL

    console.log(`TODO: Generate PZ document for receipt ${receiptId}`);
    return null;
  }
}
