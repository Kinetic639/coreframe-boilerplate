/**
 * Stock Reservations Service
 *
 * Implements hybrid reservation model:
 * - Writes to stock_reservations table for operational state
 * - Writes to stock_movements (RES/UNRES) for event log
 * - Ensures data consistency with transaction-like patterns
 */

import { createClient } from "@/utils/supabase/client";
import type {
  StockReservation,
  StockReservationInsert,
  CreateReservationRequest,
  ReleaseReservationRequest,
  CancelReservationRequest,
  ReservationWithDetails,
  ReservationFilters,
  ReservationValidation,
  AvailableInventory,
} from "../types/reservations";
import type { CreateStockMovementData } from "../types/stock-movements";

export class ReservationsService {
  private supabase = createClient();

  /**
   * Generate unique reservation number
   * Format: RES-YYYYMMDD-XXXXX
   */
  private generateReservationNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 100000)
      .toString()
      .padStart(5, "0");
    return `RES-${dateStr}-${random}`;
  }

  /**
   * Validate if there's enough available stock for reservation
   */
  async validateAvailability(
    organizationId: string,
    branchId: string,
    productId: string,
    variantId: string | undefined,
    locationId: string,
    requestedQuantity: number
  ): Promise<ReservationValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Query available inventory view
    let query = this.supabase
      .from("product_available_inventory")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .eq("location_id", locationId);

    if (variantId) {
      query = query.eq("variant_id", variantId);
    } else {
      query = query.is("variant_id", null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      errors.push(`Failed to check availability: ${error.message}`);
      return { isValid: false, errors, warnings };
    }

    if (!data) {
      errors.push("No inventory found at this location");
      return { isValid: false, errors, warnings, availableQuantity: 0, requestedQuantity };
    }

    const availableQty = Number(data.available_quantity || 0);

    if (availableQty < requestedQuantity) {
      errors.push(
        `Insufficient stock. Available: ${availableQty}, Requested: ${requestedQuantity}`
      );
      return {
        isValid: false,
        errors,
        warnings,
        availableQuantity: availableQty,
        requestedQuantity,
      };
    }

    if (availableQty < requestedQuantity * 1.2) {
      warnings.push(
        `Low stock warning. Available: ${availableQty}, Requested: ${requestedQuantity}`
      );
    }

    return {
      isValid: true,
      errors,
      warnings,
      availableQuantity: availableQty,
      requestedQuantity,
    };
  }

  /**
   * Create a new reservation
   * Double-write pattern: stock_reservations + stock_movements (RES)
   */
  async createReservation(
    request: CreateReservationRequest,
    context: { organizationId: string; branchId: string; userId: string }
  ): Promise<{ success: boolean; reservation?: StockReservation; error?: string }> {
    const { organizationId, branchId, userId } = context;

    // 1. Validate availability
    const validation = await this.validateAvailability(
      organizationId,
      branchId,
      request.productId,
      request.variantId,
      request.locationId,
      request.quantity
    );

    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(", "),
      };
    }

    // 2. Generate reservation number
    const reservationNumber = this.generateReservationNumber();

    // 3. Create reservation record
    const reservationData: StockReservationInsert = {
      reservation_number: reservationNumber,
      organization_id: organizationId,
      branch_id: branchId,
      product_id: request.productId,
      variant_id: request.variantId,
      location_id: request.locationId,
      quantity: request.quantity,
      reserved_quantity: request.quantity,
      released_quantity: 0,
      reference_type: request.referenceType,
      reference_id: request.referenceId,
      reference_number: request.referenceNumber,
      reserved_for: request.reservedFor,
      sales_order_id: request.salesOrderId,
      sales_order_item_id: request.salesOrderItemId,
      status: "active",
      priority: request.priority ?? 0,
      auto_release: request.autoRelease ?? true,
      expires_at: request.expiresAt,
      notes: request.notes,
      created_by: userId,
    };

    const { data: reservation, error: reservationError } = await this.supabase
      .from("stock_reservations")
      .insert(reservationData)
      .select()
      .single();

    if (reservationError) {
      console.error("Error creating reservation:", reservationError);
      return {
        success: false,
        error: `Failed to create reservation: ${reservationError.message}`,
      };
    }

    // 4. Create RES movement (event log)
    const movementData: CreateStockMovementData = {
      movement_type_code: "501", // RES - Reservation Created
      organization_id: organizationId,
      branch_id: branchId,
      product_id: request.productId,
      variant_id: request.variantId,
      source_location_id: request.locationId, // Logical movement - no actual transfer
      destination_location_id: undefined,
      quantity: request.quantity,
      unit_cost: 0,
      occurred_at: new Date().toISOString(),
      reference_type: "reservation",
      reference_id: reservation.id,
      reference_number: reservationNumber,
      notes: `Reservation created: ${request.reservedFor}`,
    };

    const { error: movementError } = await this.supabase
      .from("stock_movements")
      .insert(movementData);

    if (movementError) {
      console.error("Error creating reservation movement:", movementError);
      // Note: Reservation was created but movement failed
      // In production, consider rolling back or implementing retry logic
      return {
        success: true,
        reservation,
        error: "Warning: Reservation created but event log failed",
      };
    }

    return {
      success: true,
      reservation,
    };
  }

  /**
   * Release (fulfill) a reservation partially or completely
   * Double-write pattern: update stock_reservations + create UNRES movement
   */
  async releaseReservation(
    request: ReleaseReservationRequest,
    userId: string
  ): Promise<{ success: boolean; reservation?: StockReservation; error?: string }> {
    // 1. Get current reservation
    const { data: reservation, error: fetchError } = await this.supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", request.reservationId)
      .single();

    if (fetchError || !reservation) {
      return {
        success: false,
        error: "Reservation not found",
      };
    }

    // 2. Validate release quantity
    const remaining = reservation.reserved_quantity - reservation.released_quantity;
    if (request.quantity > remaining) {
      return {
        success: false,
        error: `Cannot release ${request.quantity}. Only ${remaining} remaining.`,
      };
    }

    // 3. Calculate new status
    const newReleasedQty = reservation.released_quantity + request.quantity;
    const newStatus = newReleasedQty >= reservation.reserved_quantity ? "fulfilled" : "partial";

    // 4. Update reservation
    const { data: updatedReservation, error: updateError } = await this.supabase
      .from("stock_reservations")
      .update({
        released_quantity: newReleasedQty,
        status: newStatus,
        fulfilled_at: newStatus === "fulfilled" ? new Date().toISOString() : undefined,
        fulfilled_by: newStatus === "fulfilled" ? userId : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.reservationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating reservation:", updateError);
      return {
        success: false,
        error: `Failed to release reservation: ${updateError.message}`,
      };
    }

    // 5. Create UNRES movement (event log)
    const movementData: CreateStockMovementData = {
      movement_type_code: "502", // UNRES - Reservation Released
      organization_id: reservation.organization_id,
      branch_id: reservation.branch_id,
      product_id: reservation.product_id,
      variant_id: reservation.variant_id || undefined,
      source_location_id: reservation.location_id,
      destination_location_id: undefined,
      quantity: request.quantity,
      unit_cost: 0,
      occurred_at: new Date().toISOString(),
      reference_type: "reservation",
      reference_id: reservation.id,
      reference_number: reservation.reservation_number,
      notes: request.notes || `Released ${request.quantity} from reservation`,
    };

    const { error: movementError } = await this.supabase
      .from("stock_movements")
      .insert(movementData);

    if (movementError) {
      console.error("Error creating release movement:", movementError);
      return {
        success: true,
        reservation: updatedReservation,
        error: "Warning: Reservation updated but event log failed",
      };
    }

    return {
      success: true,
      reservation: updatedReservation,
    };
  }

  /**
   * Cancel a reservation
   * Releases all reserved stock and marks as cancelled
   */
  async cancelReservation(
    request: CancelReservationRequest,
    userId: string
  ): Promise<{ success: boolean; reservation?: StockReservation; error?: string }> {
    // 1. Get current reservation
    const { data: reservation, error: fetchError } = await this.supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", request.reservationId)
      .single();

    if (fetchError || !reservation) {
      return {
        success: false,
        error: "Reservation not found",
      };
    }

    // 2. Check if already cancelled or fulfilled
    if (reservation.status === "cancelled") {
      return {
        success: false,
        error: "Reservation is already cancelled",
      };
    }

    if (reservation.status === "fulfilled") {
      return {
        success: false,
        error: "Cannot cancel a fulfilled reservation",
      };
    }

    // 3. Update reservation to cancelled
    const { data: updatedReservation, error: updateError } = await this.supabase
      .from("stock_reservations")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: request.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.reservationId)
      .select()
      .single();

    if (updateError) {
      console.error("Error cancelling reservation:", updateError);
      return {
        success: false,
        error: `Failed to cancel reservation: ${updateError.message}`,
      };
    }

    // 4. Create UNRES movement for remaining quantity (event log)
    const remainingQty = reservation.reserved_quantity - reservation.released_quantity;

    if (remainingQty > 0) {
      const movementData: CreateStockMovementData = {
        movement_type_code: "502", // UNRES - Reservation Released
        organization_id: reservation.organization_id,
        branch_id: reservation.branch_id,
        product_id: reservation.product_id,
        variant_id: reservation.variant_id || undefined,
        source_location_id: reservation.location_id,
        destination_location_id: undefined,
        quantity: remainingQty,
        unit_cost: 0,
        occurred_at: new Date().toISOString(),
        reference_type: "reservation",
        reference_id: reservation.id,
        reference_number: reservation.reservation_number,
        notes: `Reservation cancelled: ${request.reason}`,
      };

      const { error: movementError } = await this.supabase
        .from("stock_movements")
        .insert(movementData);

      if (movementError) {
        console.error("Error creating cancellation movement:", movementError);
        return {
          success: true,
          reservation: updatedReservation,
          error: "Warning: Reservation cancelled but event log failed",
        };
      }
    }

    return {
      success: true,
      reservation: updatedReservation,
    };
  }

  /**
   * Get reservation by ID
   */
  async getReservation(id: string): Promise<StockReservation | null> {
    const { data, error } = await this.supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching reservation:", error);
      return null;
    }

    return data;
  }

  /**
   * Get reservation with related data
   */
  async getReservationWithDetails(id: string): Promise<ReservationWithDetails | null> {
    const { data, error } = await this.supabase
      .from("stock_reservations")
      .select(
        `
        *,
        product:products!stock_reservations_product_id_fkey(id, name, sku, image_url),
        variant:product_variants!stock_reservations_variant_id_fkey(id, name, sku),
        location:locations!stock_reservations_location_id_fkey(id, name, code),
        salesOrder:sales_orders!stock_reservations_sales_order_id_fkey(id, order_number, customer_name, status),
        createdByUser:users!stock_reservations_created_by_fkey(id, email, full_name)
      `
      )
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error fetching reservation with details:", error);
      return null;
    }

    return data as unknown as ReservationWithDetails;
  }

  /**
   * Get reservations with filters
   */
  async getReservations(
    filters: ReservationFilters,
    organizationId: string,
    branchId?: string
  ): Promise<StockReservation[]> {
    let query = this.supabase
      .from("stock_reservations")
      .select("*")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        query = query.in("status", filters.status);
      } else {
        query = query.eq("status", filters.status);
      }
    }

    if (filters.referenceType) {
      if (Array.isArray(filters.referenceType)) {
        query = query.in("reference_type", filters.referenceType);
      } else {
        query = query.eq("reference_type", filters.referenceType);
      }
    }

    if (filters.productId) {
      query = query.eq("product_id", filters.productId);
    }

    if (filters.locationId) {
      query = query.eq("location_id", filters.locationId);
    }

    if (filters.salesOrderId) {
      query = query.eq("sales_order_id", filters.salesOrderId);
    }

    if (filters.createdBy) {
      query = query.eq("created_by", filters.createdBy);
    }

    if (filters.search) {
      query = query.or(
        `reservation_number.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%,reserved_for.ilike.%${filters.search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching reservations:", error);
      throw new Error(`Failed to fetch reservations: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get expired reservations that need auto-release
   */
  async getExpiredReservations(
    organizationId: string,
    branchId?: string
  ): Promise<StockReservation[]> {
    let query = this.supabase
      .from("stock_reservations")
      .select("*")
      .eq("organization_id", organizationId)
      .in("status", ["active", "partial"])
      .eq("auto_release", true)
      .not("expires_at", "is", null)
      .lt("expires_at", new Date().toISOString())
      .is("deleted_at", null);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching expired reservations:", error);
      return [];
    }

    return data || [];
  }

  /**
   * Get available inventory for a product at a location
   */
  async getAvailableInventory(
    organizationId: string,
    branchId: string,
    productId: string,
    variantId: string | undefined,
    locationId: string
  ): Promise<AvailableInventory | null> {
    let query = this.supabase
      .from("product_available_inventory")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("product_id", productId)
      .eq("location_id", locationId);

    if (variantId) {
      query = query.eq("variant_id", variantId);
    } else {
      query = query.is("variant_id", null);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      console.error("Error fetching available inventory:", error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      productId: data.product_id,
      variantId: data.variant_id,
      locationId: data.location_id,
      organizationId: data.organization_id,
      branchId: data.branch_id,
      quantityOnHand: Number(data.quantity_on_hand || 0),
      reservedQuantity: Number(data.reserved_quantity || 0),
      availableQuantity: Number(data.available_quantity || 0),
      totalValue: data.total_value ? Number(data.total_value) : undefined,
      averageCost: data.average_cost ? Number(data.average_cost) : undefined,
      lastMovementAt: data.last_movement_at,
      updatedAt: data.updated_at,
    };
  }
}

// Export singleton instance
export const reservationsService = new ReservationsService();
