import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateReservationInput,
  ReleaseReservationInput,
  CancelReservationInput,
  ReservationFiltersInput,
} from "../schemas/reservations.schema";
import type { Database } from "@/../supabase/types/types";

type StockReservationRow = Database["public"]["Tables"]["stock_reservations"]["Row"];
type StockReservationInsert = Database["public"]["Tables"]["stock_reservations"]["Insert"];

/**
 * Reservation validation result
 */
export interface ReservationValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  availableQuantity?: number;
  requestedQuantity?: number;
}

/**
 * Available inventory details
 */
export interface AvailableInventory {
  productId: string;
  variantId: string | null;
  locationId: string;
  organizationId: string;
  branchId: string;
  quantityOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  totalValue?: number;
  averageCost?: number;
  lastMovementAt: string | null;
  updatedAt: string | null;
}

// ==========================================
// RESERVATIONS SERVICE
// ==========================================

/**
 * Stock Reservations Service
 *
 * Implements hybrid reservation model:
 * - Writes to stock_reservations table for operational state
 * - Writes to stock_movements (RES/UNRES) for event log
 * - Ensures data consistency with transaction-like patterns
 */
export class ReservationsService {
  /**
   * Generate unique reservation number
   * Format: RES-YYYYMMDD-XXXXX
   */
  private static generateReservationNumber(): string {
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
  static async validateAvailability(
    supabase: SupabaseClient<Database>,
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
    let query = supabase
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
  static async createReservation(
    supabase: SupabaseClient<Database>,
    data: CreateReservationInput,
    context: { organizationId: string; branchId: string; userId: string }
  ) {
    const { organizationId, branchId, userId } = context;

    // 1. Validate availability
    const validation = await ReservationsService.validateAvailability(
      supabase,
      organizationId,
      branchId,
      data.productId,
      data.variantId,
      data.locationId,
      data.quantity
    );

    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    // 2. Generate reservation number
    const reservationNumber = this.generateReservationNumber();

    // 3. Create reservation record
    const reservationData: StockReservationInsert = {
      reservation_number: reservationNumber,
      organization_id: organizationId,
      branch_id: branchId,
      product_id: data.productId,
      variant_id: data.variantId || null,
      location_id: data.locationId,
      quantity: data.quantity,
      reserved_quantity: data.quantity,
      released_quantity: 0,
      reference_type: data.referenceType,
      reference_id: data.referenceId || null,
      reference_number: data.referenceNumber || null,
      reserved_for: data.reservedFor,
      sales_order_id: data.salesOrderId || null,
      sales_order_item_id: data.salesOrderItemId || null,
      status: "active",
      priority: data.priority ?? 0,
      auto_release: data.autoRelease ?? true,
      expires_at: data.expiresAt || null,
      notes: data.notes || null,
      created_by: userId,
    };

    const { data: reservation, error: reservationError } = await supabase
      .from("stock_reservations")
      .insert(reservationData)
      .select()
      .single();

    if (reservationError) {
      throw new Error(`Failed to create reservation: ${reservationError.message}`);
    }

    // 4. Create RES movement (event log)
    const movementData = {
      movement_type_code: "501", // RES - Reservation Created
      organization_id: organizationId,
      branch_id: branchId,
      product_id: data.productId,
      variant_id: data.variantId || null,
      source_location_id: data.locationId, // Logical movement - no actual transfer
      destination_location_id: null,
      quantity: data.quantity,
      unit_cost: 0,
      occurred_at: new Date().toISOString(),
      reference_type: "reservation",
      reference_id: reservation.id,
      reference_number: reservationNumber,
      notes: `Reservation created: ${data.reservedFor}`,
    };

    const { error: movementError } = await supabase.from("stock_movements").insert(movementData);

    if (movementError) {
      console.error("Error creating reservation movement:", movementError);
      // Note: Reservation was created but movement failed
      // In production, consider rolling back or implementing retry logic
    }

    return reservation as StockReservationRow;
  }

  /**
   * Release (fulfill) a reservation partially or completely
   * Double-write pattern: update stock_reservations + create UNRES movement
   */
  static async releaseReservation(
    supabase: SupabaseClient<Database>,
    data: ReleaseReservationInput,
    userId: string
  ) {
    // 1. Get current reservation
    const { data: reservation, error: fetchError } = await supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", data.reservationId)
      .single();

    if (fetchError || !reservation) {
      throw new Error("Reservation not found");
    }

    // 2. Validate release quantity
    const remaining = reservation.reserved_quantity - reservation.released_quantity;
    if (data.quantity > remaining) {
      throw new Error(`Cannot release ${data.quantity}. Only ${remaining} remaining.`);
    }

    // 3. Calculate new status
    const newReleasedQty = reservation.released_quantity + data.quantity;
    const newStatus = newReleasedQty >= reservation.reserved_quantity ? "fulfilled" : "partial";

    // 4. Update reservation
    const { data: updatedReservation, error: updateError } = await supabase
      .from("stock_reservations")
      .update({
        released_quantity: newReleasedQty,
        status: newStatus,
        fulfilled_at: newStatus === "fulfilled" ? new Date().toISOString() : undefined,
        fulfilled_by: newStatus === "fulfilled" ? userId : undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reservationId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to release reservation: ${updateError.message}`);
    }

    // 5. Create UNRES movement (event log)
    const movementData = {
      movement_type_code: "502", // UNRES - Reservation Released
      organization_id: reservation.organization_id,
      branch_id: reservation.branch_id,
      product_id: reservation.product_id,
      variant_id: reservation.variant_id,
      source_location_id: reservation.location_id,
      destination_location_id: null,
      quantity: data.quantity,
      unit_cost: 0,
      occurred_at: new Date().toISOString(),
      reference_type: "reservation",
      reference_id: reservation.id,
      reference_number: reservation.reservation_number,
      notes: data.notes || `Released ${data.quantity} from reservation`,
    };

    const { error: movementError } = await supabase.from("stock_movements").insert(movementData);

    if (movementError) {
      console.error("Error creating release movement:", movementError);
    }

    return updatedReservation as StockReservationRow;
  }

  /**
   * Cancel a reservation
   * Releases all reserved stock and marks as cancelled
   */
  static async cancelReservation(
    supabase: SupabaseClient<Database>,
    data: CancelReservationInput,
    userId: string
  ) {
    // 1. Get current reservation
    const { data: reservation, error: fetchError } = await supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", data.reservationId)
      .single();

    if (fetchError || !reservation) {
      throw new Error("Reservation not found");
    }

    // 2. Check if already cancelled or fulfilled
    if (reservation.status === "cancelled") {
      throw new Error("Reservation is already cancelled");
    }

    if (reservation.status === "fulfilled") {
      throw new Error("Cannot cancel a fulfilled reservation");
    }

    // 3. Update reservation to cancelled
    const { data: updatedReservation, error: updateError } = await supabase
      .from("stock_reservations")
      .update({
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancelled_by: userId,
        cancellation_reason: data.reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.reservationId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to cancel reservation: ${updateError.message}`);
    }

    // 4. Create UNRES movement for remaining quantity (event log)
    const remainingQty = reservation.reserved_quantity - reservation.released_quantity;

    if (remainingQty > 0) {
      const movementData = {
        movement_type_code: "502", // UNRES - Reservation Released
        organization_id: reservation.organization_id,
        branch_id: reservation.branch_id,
        product_id: reservation.product_id,
        variant_id: reservation.variant_id,
        source_location_id: reservation.location_id,
        destination_location_id: null,
        quantity: remainingQty,
        unit_cost: 0,
        occurred_at: new Date().toISOString(),
        reference_type: "reservation",
        reference_id: reservation.id,
        reference_number: reservation.reservation_number,
        notes: `Reservation cancelled: ${data.reason}`,
      };

      const { error: movementError } = await supabase.from("stock_movements").insert(movementData);

      if (movementError) {
        console.error("Error creating cancellation movement:", movementError);
      }
    }

    return updatedReservation as StockReservationRow;
  }

  /**
   * Get reservation by ID
   */
  static async getReservation(supabase: SupabaseClient<Database>, id: string) {
    const { data, error } = await supabase
      .from("stock_reservations")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      throw new Error(`Failed to fetch reservation: ${error.message}`);
    }

    return data as StockReservationRow;
  }

  /**
   * Get reservation with related data
   */
  static async getReservationWithDetails(supabase: SupabaseClient<Database>, id: string) {
    const { data, error } = await supabase
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
      throw new Error(`Failed to fetch reservation with details: ${error.message}`);
    }

    return data;
  }

  /**
   * Get reservations with filters
   */
  static async getReservations(
    supabase: SupabaseClient<Database>,
    filters: ReservationFiltersInput,
    organizationId: string,
    branchId?: string
  ) {
    let query = supabase
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
      throw new Error(`Failed to fetch reservations: ${error.message}`);
    }

    return (data || []) as StockReservationRow[];
  }

  /**
   * Get expired reservations that need auto-release
   */
  static async getExpiredReservations(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId?: string
  ) {
    let query = supabase
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

    return (data || []) as StockReservationRow[];
  }

  /**
   * Get available inventory for a product at a location
   */
  static async getAvailableInventory(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    productId: string,
    variantId: string | undefined,
    locationId: string
  ): Promise<AvailableInventory | null> {
    let query = supabase
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
