// =============================================
// Stock Movements Service
// Phase 2: Stock Movement Operations
// Handles CRUD operations for stock movements with validation
// =============================================

import { createClient } from "@/utils/supabase/client";
import type {
  StockMovementWithRelations,
  CreateStockMovementData,
  UpdateStockMovementData,
  StockMovementFilters,
  PaginatedMovements,
  MovementStatistics,
  StockInventoryLevel,
  CreateMovementResponse,
  MovementStatus,
} from "../types/stock-movements";

/**
 * Service for managing stock movements
 * Implements best practices: DRY, type-safe, performant queries
 */
export class StockMovementsService {
  private supabase = createClient();

  /**
   * Get paginated stock movements with optional filters
   * Uses efficient query building and indexing
   */
  async getMovements(
    filters: StockMovementFilters = {},
    page = 1,
    pageSize = 50
  ): Promise<PaginatedMovements> {
    let query = this.supabase
      .from("stock_movements")
      .select("*", { count: "exact" })
      .order("occurred_at", { ascending: false });

    // Apply filters efficiently (using indexed columns)
    query = this.applyFilters(query, filters);

    // Pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching movements:", error);
      throw new Error(`Failed to fetch movements: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as StockMovementWithRelations[],
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Get movements with full related data (product, locations, users)
   * Uses single query with joins for optimal performance
   */
  async getMovementsWithRelations(
    filters: StockMovementFilters = {},
    page = 1,
    pageSize = 50
  ): Promise<PaginatedMovements> {
    let query = this.supabase
      .from("stock_movements")
      .select(
        `
        *,
        movement_type:movement_types!stock_movements_movement_type_code_fkey(code, name, name_pl, name_en, category),
        product:products!stock_movements_product_id_fkey(id, name, sku),
        variant:product_variants!stock_movements_variant_id_fkey(id, name, sku),
        source_location:locations!stock_movements_source_location_id_fkey(id, name, code),
        destination_location:locations!stock_movements_destination_location_id_fkey(id, name, code)
      `,
        { count: "exact" }
      )
      .order("occurred_at", { ascending: false });

    query = this.applyFilters(query, filters);

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error fetching movements with relations:", error);
      throw new Error(`Failed to fetch movements: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as StockMovementWithRelations[],
      total: count || 0,
      page,
      page_size: pageSize,
      total_pages: Math.ceil((count || 0) / pageSize),
    };
  }

  /**
   * Get a single movement by ID with all relations
   */
  async getMovementById(id: string): Promise<StockMovementWithRelations | null> {
    const { data, error } = await this.supabase
      .from("stock_movements")
      .select(
        `
        *,
        movement_type:movement_types!stock_movements_movement_type_code_fkey(*),
        product:products!stock_movements_product_id_fkey(*),
        variant:product_variants!stock_movements_variant_id_fkey(*),
        source_location:locations!stock_movements_source_location_id_fkey(*),
        destination_location:locations!stock_movements_destination_location_id_fkey(*)
      `
      )
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching movement ${id}:`, error);
      throw new Error(`Failed to fetch movement: ${error.message}`);
    }

    return data as unknown as StockMovementWithRelations | null;
  }

  /**
   * Create a new stock movement using database function for validation
   * This ensures business rules are enforced at the database level
   */
  async createMovement(
    data: CreateStockMovementData,
    userId?: string
  ): Promise<CreateMovementResponse> {
    try {
      const { data: result, error } = await this.supabase.rpc("create_stock_movement", {
        p_movement_type_code: data.movement_type_code,
        p_organization_id: data.organization_id,
        p_branch_id: data.branch_id,
        p_product_id: data.product_id,
        p_quantity: data.quantity,
        p_source_location_id: data.source_location_id || null,
        p_destination_location_id: data.destination_location_id || null,
        p_variant_id: data.variant_id || null,
        p_unit_cost: data.unit_cost || null,
        p_reference_type: data.reference_type || null,
        p_reference_id: data.reference_id || null,
        p_created_by: userId || null,
        p_notes: data.notes || null,
        p_occurred_at: data.occurred_at || new Date().toISOString(),
      });

      if (error) {
        return {
          success: false,
          errors: [error.message],
        };
      }

      // Fetch the created movement to get the movement_number
      const movement = await this.getMovementById(result);

      return {
        success: true,
        movement_id: result,
        movement_number: movement?.movement_number,
      };
    } catch (err) {
      const error = err as Error;
      return {
        success: false,
        errors: [error.message],
      };
    }
  }

  /**
   * Update movement (only allowed fields, before approval/completion)
   */
  async updateMovement(
    id: string,
    data: UpdateStockMovementData,
    userId?: string
  ): Promise<boolean> {
    const updateData: Record<string, unknown> = {
      ...data,
      updated_by: userId,
    };

    const { error } = await this.supabase
      .from("stock_movements")
      .update(updateData)
      .eq("id", id)
      .eq("status", "pending"); // Only pending movements can be updated

    if (error) {
      console.error(`Error updating movement ${id}:`, error);
      throw new Error(`Failed to update movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Approve a movement
   */
  async approveMovement(id: string, userId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("stock_movements")
      .update({
        status: "approved" as MovementStatus,
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "pending")
      .eq("requires_approval", true);

    if (error) {
      console.error(`Error approving movement ${id}:`, error);
      throw new Error(`Failed to approve movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Complete a movement (mark as completed)
   */
  async completeMovement(id: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("stock_movements")
      .update({
        status: "completed" as MovementStatus,
        completed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "approved");

    if (error) {
      console.error(`Error completing movement ${id}:`, error);
      throw new Error(`Failed to complete movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Cancel a movement
   */
  async cancelMovement(id: string, reason: string, userId?: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("stock_movements")
      .update({
        status: "cancelled" as MovementStatus,
        cancellation_reason: reason,
        cancelled_by: userId,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", id)
      .in("status", ["pending", "approved"]);

    if (error) {
      console.error(`Error cancelling movement ${id}:`, error);
      throw new Error(`Failed to cancel movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Get movements pending approval
   */
  async getPendingApprovals(
    organizationId: string,
    branchId?: string
  ): Promise<StockMovementWithRelations[]> {
    let query = this.supabase
      .from("stock_movements")
      .select(
        `
        *,
        movement_type:movement_types!stock_movements_movement_type_code_fkey(code, name, name_pl, name_en),
        product:products!stock_movements_product_id_fkey(id, name, sku)
      `
      )
      .eq("organization_id", organizationId)
      .eq("status", "pending")
      .eq("requires_approval", true)
      .order("occurred_at", { ascending: true });

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching pending approvals:", error);
      throw new Error(`Failed to fetch pending approvals: ${error.message}`);
    }

    return (data || []) as unknown as StockMovementWithRelations[];
  }

  /**
   * Get movement statistics
   */
  async getStatistics(
    organizationId: string,
    branchId?: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<MovementStatistics> {
    let query = this.supabase
      .from("stock_movements")
      .select("category, status, total_cost, completed_at")
      .eq("organization_id", organizationId);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    if (dateFrom) {
      query = query.gte("occurred_at", dateFrom);
    }

    if (dateTo) {
      query = query.lte("occurred_at", dateTo);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching statistics:", error);
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }

    // Aggregate data
    const stats: MovementStatistics = {
      total_movements: data?.length || 0,
      pending_approvals: 0,
      completed_today: 0,
      total_value: 0,
      by_category: {
        receipt: 0,
        issue: 0,
        transfer: 0,
        adjustment: 0,
        reservation: 0,
        ecommerce: 0,
      },
      by_status: {
        pending: 0,
        approved: 0,
        completed: 0,
        cancelled: 0,
        reversed: 0,
      },
    };

    const today = new Date().toISOString().split("T")[0];

    data?.forEach((movement) => {
      // Count by category
      if (movement.category) {
        stats.by_category[movement.category as keyof typeof stats.by_category]++;
      }

      // Count by status
      if (movement.status) {
        stats.by_status[movement.status as keyof typeof stats.by_status]++;
      }

      // Count pending approvals
      if (movement.status === "pending") {
        stats.pending_approvals++;
      }

      // Count completed today
      if (movement.status === "completed" && movement.completed_at?.startsWith(today)) {
        stats.completed_today++;
      }

      // Sum total value
      if (movement.total_cost) {
        stats.total_value += parseFloat(movement.total_cost.toString());
      }
    });

    return stats;
  }

  /**
   * Get stock inventory levels
   */
  async getInventoryLevels(
    organizationId: string,
    branchId?: string,
    productId?: string,
    locationId?: string
  ): Promise<StockInventoryLevel[]> {
    let query = this.supabase
      .from("stock_inventory")
      .select("*")
      .eq("organization_id", organizationId);

    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    if (productId) {
      query = query.eq("product_id", productId);
    }

    if (locationId) {
      query = query.eq("location_id", locationId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching inventory levels:", error);
      throw new Error(`Failed to fetch inventory levels: ${error.message}`);
    }

    return (data || []) as StockInventoryLevel[];
  }

  /**
   * Check stock availability using database function
   */
  async checkStockAvailability(
    productId: string,
    locationId: string,
    quantity: number,
    variantId?: string
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc("check_stock_availability", {
      p_product_id: productId,
      p_variant_id: variantId || null,
      p_location_id: locationId,
      p_quantity: quantity,
    });

    if (error) {
      console.error("Error checking stock availability:", error);
      return false;
    }

    return data as boolean;
  }

  /**
   * Get current stock level using database function
   */
  async getStockLevel(
    productId: string,
    variantId?: string,
    locationId?: string,
    organizationId?: string,
    branchId?: string
  ): Promise<number> {
    const { data, error } = await this.supabase.rpc("get_stock_level", {
      p_product_id: productId,
      p_variant_id: variantId || null,
      p_location_id: locationId || null,
      p_organization_id: organizationId || null,
      p_branch_id: branchId || null,
    });

    if (error) {
      console.error("Error getting stock level:", error);
      return 0;
    }

    return parseFloat(data?.toString() || "0");
  }

  /**
   * Apply filters to query (DRY principle)
   * @private
   */
  private applyFilters(query: any, filters: StockMovementFilters): any {
    // Always exclude soft-deleted records
    query = query.is("deleted_at", null);

    if (filters.organization_id) {
      query = query.eq("organization_id", filters.organization_id);
    }

    if (filters.branch_id) {
      query = query.eq("branch_id", filters.branch_id);
    }

    if (filters.product_id) {
      query = query.eq("product_id", filters.product_id);
    }

    if (filters.variant_id) {
      query = query.eq("variant_id", filters.variant_id);
    }

    if (filters.movement_type_code) {
      query = query.eq("movement_type_code", filters.movement_type_code);
    }

    if (filters.category) {
      query = query.eq("category", filters.category);
    }

    if (filters.status) {
      query = query.eq("status", filters.status);
    }

    if (filters.source_location_id) {
      query = query.eq("source_location_id", filters.source_location_id);
    }

    if (filters.destination_location_id) {
      query = query.eq("destination_location_id", filters.destination_location_id);
    }

    if (filters.reference_type) {
      query = query.eq("reference_type", filters.reference_type);
    }

    if (filters.reference_id) {
      query = query.eq("reference_id", filters.reference_id);
    }

    if (filters.created_by) {
      query = query.eq("created_by", filters.created_by);
    }

    if (filters.date_from) {
      query = query.gte("occurred_at", filters.date_from);
    }

    if (filters.date_to) {
      query = query.lte("occurred_at", filters.date_to);
    }

    if (filters.search) {
      query = query.or(
        `movement_number.ilike.%${filters.search}%,document_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      );
    }

    return query;
  }
}

// Export singleton instance
export const stockMovementsService = new StockMovementsService();
