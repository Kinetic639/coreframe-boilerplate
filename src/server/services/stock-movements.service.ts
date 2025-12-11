// =============================================
// Stock Movements Service (Server-side)
// Migrated from src/modules/warehouse/api/stock-movements-service.ts
// Handles all stock movement operations with validation
// =============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateStockMovementInput,
  UpdateStockMovementInput,
  StockMovementFilters,
  CheckStockAvailabilityInput,
} from "@/server/schemas/stock-movements.schema";

type StockMovement = Database["public"]["Tables"]["stock_movements"]["Row"];
type MovementType = Database["public"]["Tables"]["movement_types"]["Row"];

export interface StockMovementWithRelations extends StockMovement {
  movement_type?: MovementType;
  product?: {
    id: string;
    name: string;
    sku: string;
  };
  variant?: {
    id: string;
    name: string;
    sku: string;
  };
  source_location?: {
    id: string;
    name: string;
    code: string | null;
  };
  destination_location?: {
    id: string;
    name: string;
    code: string | null;
  };
  created_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  approved_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
  cancelled_by_user?: {
    id: string;
    email: string;
    first_name: string | null;
    last_name: string | null;
  };
}

export interface PaginatedMovements {
  data: StockMovementWithRelations[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface MovementStatistics {
  total_movements: number;
  pending_approvals: number;
  completed_today: number;
  total_value: number;
  by_category: Record<string, number>;
  by_status: Record<string, number>;
}

export interface StockInventoryLevel {
  product_id: string | null;
  variant_id: string | null;
  location_id: string | null;
  branch_id: string | null;
  organization_id: string | null;
  available_quantity: number | null;
  reserved_quantity: number | null;
  available_to_promise: number | null;
  average_cost: number | null;
  total_value: number | null;
  total_movements: number | null;
  last_movement_at: string | null;
}

export class StockMovementsService {
  /**
   * Get paginated stock movements with optional filters
   */
  static async getMovements(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    filters: StockMovementFilters
  ): Promise<PaginatedMovements> {
    let query = supabase
      .from("stock_movements")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });

    // Apply filters
    if (filters.search) {
      query = query.or(
        `movement_number.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%,notes.ilike.%${filters.search}%`
      ) as any;
    }

    if (filters.movement_type_code && filters.movement_type_code.length > 0) {
      query = query.in("movement_type_code", filters.movement_type_code) as any;
    }

    if (filters.category && filters.category.length > 0) {
      query = query.in("category", filters.category) as any;
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status) as any;
    }

    if (filters.product_id) {
      query = query.eq("product_id", filters.product_id) as any;
    }

    if (filters.variant_id) {
      query = query.eq("variant_id", filters.variant_id) as any;
    }

    if (filters.source_location_id) {
      query = query.eq("source_location_id", filters.source_location_id) as any;
    }

    if (filters.destination_location_id) {
      query = query.eq("destination_location_id", filters.destination_location_id) as any;
    }

    if (filters.reference_type) {
      query = query.eq("reference_type", filters.reference_type) as any;
    }

    if (filters.reference_id) {
      query = query.eq("reference_id", filters.reference_id) as any;
    }

    if (filters.created_by) {
      query = query.eq("created_by", filters.created_by) as any;
    }

    if (filters.approved_by) {
      query = query.eq("approved_by", filters.approved_by) as any;
    }

    if (filters.start_date) {
      query = query.gte("occurred_at", filters.start_date) as any;
    }

    if (filters.end_date) {
      query = query.lte("occurred_at", filters.end_date) as any;
    }

    if (filters.requires_approval !== undefined) {
      query = query.eq("requires_approval", filters.requires_approval) as any;
    }

    // Pagination
    const limit = filters.pageSize;
    const offset = filters.offset || (filters.page - 1) * filters.pageSize;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch movements: ${error.message}`);
    }

    return {
      data: (data || []) as unknown as StockMovementWithRelations[],
      total: count || 0,
      page: filters.page,
      page_size: limit,
      total_pages: Math.ceil((count || 0) / limit),
    };
  }

  /**
   * Get movements with full related data (product, locations, users)
   */
  static async getMovementsWithRelations(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    filters: StockMovementFilters
  ): Promise<PaginatedMovements> {
    let query = supabase
      .from("stock_movements")
      .select(
        `
        *,
        movement_type:movement_types!stock_movements_movement_type_code_fkey(code, name, name_pl, name_en, category, polish_document_type),
        product:products!stock_movements_product_id_fkey(id, name, sku),
        variant:product_variants!stock_movements_variant_id_fkey(id, name, sku),
        source_location:locations!stock_movements_source_location_id_fkey(id, name, code),
        destination_location:locations!stock_movements_destination_location_id_fkey(id, name, code)
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });

    // Apply same filters as getMovements
    query = this.applyFiltersToQuery(query, filters);

    const limit = filters.pageSize;
    const offset = filters.offset || (filters.page - 1) * filters.pageSize;
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch movements with relations: ${error.message}`);
    }

    const movements = (data || []) as unknown as StockMovementWithRelations[];

    // Fetch user data
    const userIds = new Set<string>();
    movements.forEach((m) => {
      if (m.created_by) userIds.add(m.created_by);
      if (m.approved_by) userIds.add(m.approved_by);
      if (m.cancelled_by) userIds.add(m.cancelled_by);
    });

    if (userIds.size > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, email, first_name, last_name")
        .in("id", Array.from(userIds));

      const usersMap = new Map(users?.map((u) => [u.id, u]) || []);

      movements.forEach((movement) => {
        if (movement.created_by) {
          movement.created_by_user = usersMap.get(movement.created_by) as any;
        }
        if (movement.approved_by) {
          movement.approved_by_user = usersMap.get(movement.approved_by) as any;
        }
        if (movement.cancelled_by) {
          movement.cancelled_by_user = usersMap.get(movement.cancelled_by) as any;
        }
      });
    }

    return {
      data: movements,
      total: count || 0,
      page: filters.page,
      page_size: limit,
      total_pages: Math.ceil((count || 0) / limit),
    };
  }

  /**
   * Helper to apply filters to query
   */
  private static applyFiltersToQuery(query: any, filters: StockMovementFilters): any {
    if (filters.search) {
      query = query.or(
        `movement_number.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%`
      );
    }

    if (filters.movement_type_code && filters.movement_type_code.length > 0) {
      query = query.in("movement_type_code", filters.movement_type_code);
    }

    if (filters.category && filters.category.length > 0) {
      query = query.in("category", filters.category);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters.product_id) {
      query = query.eq("product_id", filters.product_id);
    }

    if (filters.start_date) {
      query = query.gte("occurred_at", filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte("occurred_at", filters.end_date);
    }

    return query;
  }

  /**
   * Get a single movement by ID with all relations
   */
  static async getMovementById(
    supabase: SupabaseClient<Database>,
    movementId: string
  ): Promise<StockMovementWithRelations | null> {
    const { data, error } = await supabase
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
      .eq("id", movementId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch movement: ${error.message}`);
    }

    return data as unknown as StockMovementWithRelations | null;
  }

  /**
   * Create a new stock movement using database function for validation
   */
  static async createMovement(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    userId: string,
    input: CreateStockMovementInput
  ): Promise<any> {
    try {
      const { data, error } = await supabase.rpc("create_stock_movement", {
        p_movement_type_code: input.movement_type_code,
        p_organization_id: organizationId,
        p_branch_id: branchId,
        p_product_id: input.product_id,
        p_quantity: input.quantity,
        p_source_location_id: input.source_location_id || null,
        p_destination_location_id: input.destination_location_id || null,
        p_variant_id: input.variant_id || null,
        p_unit_cost: input.unit_cost || null,
        p_total_cost: input.total_cost || null,
        p_currency: input.currency,
        p_reference_type: input.reference_type || null,
        p_reference_id: input.reference_id || null,
        p_reference_number: input.reference_number || null,
        p_batch_number: input.batch_number || null,
        p_serial_number: input.serial_number || null,
        p_lot_number: input.lot_number || null,
        p_expiry_date: input.expiry_date || null,
        p_manufacturing_date: input.manufacturing_date || null,
        p_occurred_at: input.occurred_at || new Date().toISOString(),
        p_notes: input.notes || null,
        p_metadata: (input.metadata as any) || {},
        p_created_by: userId,
      } as any);

      if (error) {
        throw new Error(error.message);
      }

      return data;
    } catch (error: any) {
      throw new Error(`Failed to create movement: ${error.message}`);
    }
  }

  /**
   * Update an existing movement
   */
  static async updateMovement(
    supabase: SupabaseClient<Database>,
    movementId: string,
    userId: string,
    input: UpdateStockMovementInput
  ): Promise<StockMovement> {
    const { data, error } = await supabase
      .from("stock_movements")
      .update({
        ...input,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", movementId)
      .eq("status", "draft") // Only draft movements can be updated
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update movement: ${error.message}`);
    }

    return data;
  }

  /**
   * Approve a movement
   */
  static async approveMovement(
    supabase: SupabaseClient<Database>,
    movementId: string,
    userId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from("stock_movements")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      } as any)
      .eq("id", movementId)
      .eq("status", "pending");

    if (error) {
      throw new Error(`Failed to approve movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Complete a movement
   */
  static async completeMovement(
    supabase: SupabaseClient<Database>,
    movementId: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from("stock_movements")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      } as any)
      .eq("id", movementId)
      .in("status", ["approved", "pending"]);

    if (error) {
      throw new Error(`Failed to complete movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Cancel a movement
   */
  static async cancelMovement(
    supabase: SupabaseClient<Database>,
    movementId: string,
    reason: string,
    userId?: string
  ): Promise<boolean> {
    const { error } = await supabase
      .from("stock_movements")
      .update({
        status: "cancelled",
        cancellation_reason: reason,
        cancelled_by: userId || null,
        cancelled_at: new Date().toISOString(),
      } as any)
      .eq("id", movementId)
      .neq("status", "completed");

    if (error) {
      throw new Error(`Failed to cancel movement: ${error.message}`);
    }

    return true;
  }

  /**
   * Get pending approvals
   */
  static async getPendingApprovals(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    limit = 50
  ): Promise<StockMovementWithRelations[]> {
    const { data, error } = await supabase
      .from("stock_movements")
      .select(
        `
        *,
        movement_type:movement_types!stock_movements_movement_type_code_fkey(*),
        product:products!stock_movements_product_id_fkey(id, name, sku)
      `
      )
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .eq("status", "pending")
      .eq("requires_approval", true)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: true })
      .limit(limit);

    if (error) {
      throw new Error(`Failed to fetch pending approvals: ${error.message}`);
    }

    return (data || []) as unknown as StockMovementWithRelations[];
  }

  /**
   * Get movement statistics
   */
  static async getStatistics(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    startDate?: string,
    endDate?: string
  ): Promise<MovementStatistics> {
    let query = supabase
      .from("stock_movements")
      .select("*", { count: "exact" })
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId)
      .is("deleted_at", null);

    if (startDate) {
      query = query.gte("occurred_at", startDate) as any;
    }

    if (endDate) {
      query = query.lte("occurred_at", endDate) as any;
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch statistics: ${error.message}`);
    }

    const movements = data || [];
    const stats: MovementStatistics = {
      total_movements: count || 0,
      pending_approvals: movements.filter((m) => m.status === "pending").length,
      completed_today: movements.filter(
        (m) =>
          m.status === "completed" &&
          new Date(m.completed_at!).toDateString() === new Date().toDateString()
      ).length,
      total_value: movements.reduce((sum, m) => sum + (m.total_cost || 0), 0),
      by_category: {},
      by_status: {},
    };

    // Group by category
    movements.forEach((m) => {
      stats.by_category[m.category] = (stats.by_category[m.category] || 0) + 1;
      stats.by_status[m.status] = (stats.by_status[m.status] || 0) + 1;
    });

    return stats;
  }

  /**
   * Get inventory levels by location
   */
  static async getInventoryLevels(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    branchId: string,
    locationId?: string,
    productId?: string
  ): Promise<StockInventoryLevel[]> {
    let query = supabase
      .from("stock_inventory")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("branch_id", branchId);

    if (locationId) {
      query = query.eq("location_id", locationId) as any;
    }

    if (productId) {
      query = query.eq("product_id", productId) as any;
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch inventory levels: ${error.message}`);
    }

    return (data || []) as StockInventoryLevel[];
  }

  /**
   * Check stock availability
   */
  static async checkStockAvailability(
    supabase: SupabaseClient<Database>,
    input: CheckStockAvailabilityInput
  ): Promise<{ available: boolean; available_quantity: number }> {
    let query = supabase
      .from("stock_inventory")
      .select("available_quantity")
      .eq("product_id", input.product_id)
      .eq("location_id", input.location_id);

    if (input.variant_id) {
      query = query.eq("variant_id", input.variant_id) as any;
    } else {
      query = query.is("variant_id", null) as any;
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to check stock availability: ${error.message}`);
    }

    const availableQty = data?.available_quantity || 0;

    return {
      available: availableQty >= input.quantity,
      available_quantity: availableQty,
    };
  }

  /**
   * Get stock level for specific product/location
   */
  static async getStockLevel(
    supabase: SupabaseClient<Database>,
    productId: string,
    locationId: string,
    variantId?: string | null
  ): Promise<StockInventoryLevel | null> {
    let query = supabase
      .from("stock_inventory")
      .select("*")
      .eq("product_id", productId)
      .eq("location_id", locationId);

    if (variantId) {
      query = query.eq("variant_id", variantId) as any;
    } else {
      query = query.is("variant_id", null) as any;
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch stock level: ${error.message}`);
    }

    return data as StockInventoryLevel | null;
  }
}
