/**
 * Receipt Service
 * Migrated from src/modules/warehouse/api/receipt-service.ts
 *
 * Handles receipt document operations following Solution B architecture:
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

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  ProcessDeliveryReceiptInput,
  CancelReceiptInput,
  ReceiptFiltersInput,
} from "../schemas/receipts.schema";

// Type definitions
type ReceiptDocument = Database["public"]["Tables"]["receipt_documents"]["Row"];
type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];

export interface ReceiptDocumentWithRelations extends ReceiptDocument {
  created_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  received_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  } | null;
  movements?: StockMovement[];
}

export interface ReceiptsResponse {
  receipts: ReceiptDocumentWithRelations[];
  total: number;
}

export interface PartialReceiptStatus {
  delivery_movement_id: string;
  quantity_ordered: number;
  quantity_received: number;
  quantity_remaining: number;
  receipts: Array<{
    receipt_id: string;
    receipt_number: string;
    receipt_date: string;
    quantity: number;
    status: string;
  }>;
  is_complete: boolean;
  can_receive_more: boolean;
}

export interface ProcessReceiptResult {
  success: boolean;
  receipt_id?: string;
  receipt_number?: string;
  pz_document_url?: string | null;
  movements_created?: string[];
  error?: string;
}

export class ReceiptsService {
  /**
   * Get receipt by ID with all related data
   */
  static async getReceiptById(
    supabase: SupabaseClient<Database>,
    receiptId: string,
    organizationId: string
  ): Promise<ReceiptDocumentWithRelations | null> {
    // Fetch receipt document
    const { data: receipt, error: receiptError } = await supabase
      .from("receipt_documents")
      .select("*")
      .eq("id", receiptId)
      .eq("organization_id", organizationId)
      .single();

    if (receiptError) {
      if (receiptError.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch receipt: ${receiptError.message}`);
    }

    if (!receipt) return null;

    // Fetch linked movements
    const { data: receiptMovements, error: movementsError } = await supabase
      .from("receipt_movements")
      .select("movement_id")
      .eq("receipt_id", receiptId);

    if (movementsError) {
      throw new Error(`Failed to fetch receipt movements: ${movementsError.message}`);
    }

    const movementIds = receiptMovements?.map((rm) => rm.movement_id) || [];

    let movements: StockMovement[] = [];
    if (movementIds.length > 0) {
      const { data: movementsData, error: movError } = await supabase
        .from("stock_movements")
        .select("*")
        .in("id", movementIds);

      if (movError) {
        throw new Error(`Failed to fetch movements: ${movError.message}`);
      }
      movements = (movementsData as StockMovement[]) || [];
    }

    // Fetch user data
    const userIds = [receipt.created_by, receipt.received_by].filter(
      (id): id is string => id !== null
    );

    const usersMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase
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
  }

  /**
   * Get all receipts with filters
   */
  static async getReceipts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string | null,
    filters: ReceiptFiltersInput
  ): Promise<ReceiptsResponse> {
    let query = supabase
      .from("receipt_documents")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId);

    if (branchId) {
      query = query.eq("branch_id", branchId) as any;
    }

    if (filters.status) {
      query = query.eq("status", filters.status) as any;
    }

    if (filters.receipt_type) {
      query = query.eq("receipt_type", filters.receipt_type) as any;
    }

    if (filters.date_from) {
      query = query.gte("receipt_date", filters.date_from) as any;
    }

    if (filters.date_to) {
      query = query.lte("receipt_date", filters.date_to) as any;
    }

    if (filters.received_by) {
      query = query.eq("received_by", filters.received_by) as any;
    }

    if (filters.search) {
      query = query.or(
        `receipt_number.ilike.%${filters.search}%,pz_document_number.ilike.%${filters.search}%`
      ) as any;
    }

    if (filters.has_quality_issues !== undefined) {
      query = query.eq("quality_check_passed", !filters.has_quality_issues) as any;
    }

    // Sorting
    const sortBy = filters.sort_by || "receipt_date";
    const sortOrder = filters.sort_order || "desc";
    query = query.order(sortBy, { ascending: sortOrder === "asc" });

    // Pagination
    if (filters.limit) {
      const offset = filters.offset || 0;
      query = query.range(offset, offset + filters.limit - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch receipts: ${error.message}`);
    }

    return {
      receipts: (data as unknown as ReceiptDocumentWithRelations[]) || [],
      total: count || 0,
    };
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
  static async processDeliveryReceipt(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    input: ProcessDeliveryReceiptInput,
    userId: string
  ): Promise<ProcessReceiptResult> {
    try {
      // Step 1: Fetch original delivery movement
      const { data: originalMovement, error: movementError } = await supabase
        .from("stock_movements")
        .select("*")
        .eq("id", input.delivery_movement_id)
        .eq("organization_id", organizationId)
        .single();

      if (movementError || !originalMovement) {
        return {
          success: false,
          error: "Original delivery movement not found",
        };
      }

      const movementsCreated: string[] = [];

      // Step 2: Generate receipt number
      const { data: receiptNumberData, error: numberError } = await supabase.rpc(
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
        typeof input.receipt_date === "string"
          ? input.receipt_date
          : input.receipt_date
            ? new Date(input.receipt_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0];

      const { data: receipt, error: receiptError } = await supabase
        .from("receipt_documents")
        .insert({
          receipt_number: receiptNumberData,
          organization_id: originalMovement.organization_id,
          branch_id: originalMovement.branch_id || null,
          receipt_type: input.receipt_type,
          receipt_date: receiptDate,
          created_by: userId,
          received_by: input.received_by || userId,
          quality_check_passed: input.quality_check_passed ?? true,
          quality_notes: input.quality_notes || null,
          receiving_notes: input.receiving_notes || null,
          status: "draft",
        } as any)
        .select()
        .single();

      if (receiptError || !receipt) {
        return {
          success: false,
          error: "Failed to create receipt document",
        };
      }

      // Step 4: Process each line item
      for (const item of input.items) {
        const quantityAccepted = item.quantity_received - item.quantity_damaged;

        // Create movement for accepted quantity
        if (quantityAccepted > 0) {
          const expiryDate = item.expiry_date
            ? typeof item.expiry_date === "string"
              ? item.expiry_date
              : new Date(item.expiry_date).toISOString().split("T")[0]
            : null;

          const { data: acceptedMovement, error: acceptedError } = await supabase
            .from("stock_movements")
            .insert({
              organization_id: originalMovement.organization_id,
              branch_id: originalMovement.branch_id,
              movement_type_code: originalMovement.movement_type_code, // Same type (101)
              category: originalMovement.category,
              product_id: item.product_id,
              variant_id: item.variant_id || null,
              quantity: quantityAccepted,
              unit_of_measure: item.unit,
              unit_cost: item.unit_cost || null,
              total_cost: item.unit_cost ? item.unit_cost * quantityAccepted : null,
              destination_location_id: item.destination_location_id,
              batch_number: item.batch_number || null,
              serial_number: item.serial_number || null,
              expiry_date: expiryDate,
              status: "completed",
              created_by: userId,
              parent_movement_id: input.delivery_movement_id,
              reference_number: originalMovement.reference_number,
              notes: item.notes || null,
            } as any)
            .select()
            .single();

          if (acceptedError || !acceptedMovement) {
            console.error("Failed to create accepted movement:", acceptedError);
            continue;
          }

          movementsCreated.push(acceptedMovement.id);

          // Link to receipt
          await supabase.from("receipt_movements").insert({
            receipt_id: receipt.id,
            movement_id: acceptedMovement.id,
          } as any);
        }

        // Create damage movement if needed
        if (item.quantity_damaged > 0) {
          // Find damage movement type (206)
          const { data: damageType } = await supabase
            .from("movement_types")
            .select("code, category")
            .eq("code", "206")
            .single();

          if (damageType) {
            const { data: damageMovement } = await supabase
              .from("stock_movements")
              .insert({
                organization_id: originalMovement.organization_id,
                branch_id: originalMovement.branch_id,
                movement_type_code: damageType.code,
                category: damageType.category,
                product_id: item.product_id,
                variant_id: item.variant_id || null,
                quantity: item.quantity_damaged,
                unit_of_measure: item.unit,
                source_location_id: item.destination_location_id, // Same location
                status: "completed",
                created_by: userId,
                parent_movement_id: input.delivery_movement_id,
                reference_number: `DAMAGE-${originalMovement.reference_number || ""}`,
                notes: `Damaged goods from receipt ${receipt.receipt_number}. Reason: ${item.damage_reason || "Unknown"}. ${item.damage_notes || ""}`,
              } as any)
              .select()
              .single();

            if (damageMovement) {
              movementsCreated.push(damageMovement.id);
            }
          }
        }
      }

      // Step 5: Update receipt status to completed
      await supabase
        .from("receipt_documents")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        } as any)
        .eq("id", receipt.id);

      // Step 6: Update original delivery status
      const isPartialReceipt = input.receipt_type === "partial";
      const newStatus = isPartialReceipt ? "approved" : "completed";

      await supabase
        .from("stock_movements")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", input.delivery_movement_id);

      // Step 7: Generate PZ document (placeholder for now)
      const pzDocumentUrl = await this.generatePZDocument(supabase, receipt.id);

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
  static async getPartialReceiptStatus(
    supabase: SupabaseClient<Database>,
    deliveryMovementId: string,
    organizationId: string
  ): Promise<PartialReceiptStatus | null> {
    try {
      // Get original delivery
      const { data: delivery } = await supabase
        .from("stock_movements")
        .select("quantity")
        .eq("id", deliveryMovementId)
        .eq("organization_id", organizationId)
        .single();

      if (!delivery) return null;

      // Get all child movements (receipts)
      const { data: childMovements } = await supabase
        .from("stock_movements")
        .select("id, quantity")
        .eq("parent_movement_id", deliveryMovementId)
        .eq("status", "completed");

      const quantityReceived = childMovements?.reduce((sum, m) => sum + (m.quantity || 0), 0) || 0;

      // Get associated receipts
      const movementIds = childMovements?.map((m) => m.id) || [];
      let receipts: any[] = [];

      if (movementIds.length > 0) {
        const { data: receiptMovements } = await supabase
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
  static async cancelReceipt(
    supabase: SupabaseClient<Database>,
    receiptId: string,
    organizationId: string,
    input: CancelReceiptInput,
    userId: string
  ): Promise<void> {
    // Update receipt status
    const { error: receiptError } = await supabase
      .from("receipt_documents")
      .update({
        status: "cancelled",
        receiving_notes: input.reason,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", receiptId)
      .eq("organization_id", organizationId);

    if (receiptError) {
      throw new Error(`Failed to cancel receipt: ${receiptError.message}`);
    }

    // Cancel all linked movements
    const { data: receiptMovements } = await supabase
      .from("receipt_movements")
      .select("movement_id")
      .eq("receipt_id", receiptId);

    if (receiptMovements && receiptMovements.length > 0) {
      const movementIds = receiptMovements.map((rm) => rm.movement_id);

      await supabase
        .from("stock_movements")
        .update({
          status: "cancelled",
          cancelled_by: userId,
          cancelled_at: new Date().toISOString(),
          cancellation_reason: `Receipt cancelled: ${input.reason}`,
        } as any)
        .in("id", movementIds);
    }
  }

  /**
   * Generate PZ document (placeholder)
   * TODO: Implement actual PDF generation with puppeteer or react-pdf
   * @private
   */
  private static async generatePZDocument(
    _supabase: SupabaseClient<Database>,
    receiptId: string
  ): Promise<string | null> {
    // This is a placeholder
    // In production, this would:
    // 1. Fetch receipt details
    // 2. Render PZ template
    // 3. Generate PDF
    // 4. Upload to Supabase Storage
    // 5. Update receipt_documents.pz_document_url
    // 6. Return URL

    console.warn(`TODO: Generate PZ document for receipt ${receiptId}`);
    return null;
  }
}
