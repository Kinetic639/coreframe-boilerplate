/**
 * Product-Suppliers Service
 * Migrated from src/modules/warehouse/api/product-suppliers-service.ts
 * Manages many-to-many relationships between products and suppliers
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type { ProductSupplierFormData } from "@/server/schemas/product-suppliers.schema";

// Type definitions
export interface ProductSupplierWithRelations {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier_sku: string | null;
  supplier_product_name: string | null;
  supplier_product_description: string | null;
  unit_price: number;
  currency_code: string;
  price_valid_from: string | null;
  price_valid_until: string | null;
  lead_time_days: number;
  min_order_qty: number;
  order_multiple: number;
  is_preferred: boolean;
  is_active: boolean;
  priority_rank: number;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  created_by: string;
  supplier?: any;
  product?: any;
}

export interface BestPriceResult {
  supplier: ProductSupplierWithRelations;
  total_cost: number;
  meets_moq: boolean;
  adjusted_quantity: number;
}

export interface SupplierPriceHistory {
  id: string;
  product_supplier_id: string;
  unit_price: number;
  currency_code: string;
  effective_date: string;
  change_reason: string | null;
  created_at: string;
  created_by: string;
}

export interface PriceHistoryResponse {
  history: SupplierPriceHistory[];
  current_price: number;
  price_trend: "increasing" | "decreasing" | "stable";
  avg_price: number;
}

export class ProductSuppliersService {
  // =====================================================
  // Get Product Suppliers
  // =====================================================

  /**
   * Get all suppliers for a specific product
   */
  static async getProductSuppliers(
    supabase: SupabaseClient<Database>,
    productId: string,
    activeOnly: boolean = true
  ): Promise<ProductSupplierWithRelations[]> {
    let query = supabase
      .from("product_suppliers")
      .select(
        `
        *,
        supplier:business_accounts!supplier_id (
          id,
          name,
          email,
          phone,
          is_active,
          address_line_1,
          address_line_2,
          city,
          state_province,
          postal_code,
          country
        ),
        product:products!product_id (
          id,
          name,
          sku,
          unit,
          description
        )
      `
      )
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("is_preferred", { ascending: false })
      .order("priority_rank", { ascending: true })
      .order("unit_price", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true) as any;
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch product suppliers: ${error.message}`);
    }

    return (data as any[]) || [];
  }

  /**
   * Get preferred supplier for a product
   */
  static async getPreferredSupplier(
    supabase: SupabaseClient<Database>,
    productId: string
  ): Promise<ProductSupplierWithRelations | null> {
    const { data, error } = await supabase
      .from("product_suppliers")
      .select(
        `
        *,
        supplier:business_accounts!supplier_id (
          id,
          name,
          email,
          phone,
          is_active,
          address_line_1,
          address_line_2,
          city,
          state_province,
          postal_code,
          country
        ),
        product:products!product_id (
          id,
          name,
          sku,
          unit,
          description
        )
      `
      )
      .eq("product_id", productId)
      .eq("is_preferred", true)
      .eq("is_active", true)
      .is("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw new Error(`Failed to fetch preferred supplier: ${error.message}`);
    }

    return (data as any) || null;
  }

  /**
   * Get best price supplier considering MOQ and order multiples
   */
  static async getBestPriceSupplier(
    supabase: SupabaseClient<Database>,
    productId: string,
    quantity: number
  ): Promise<BestPriceResult | null> {
    const suppliers = await this.getProductSuppliers(supabase, productId, true);

    if (suppliers.length === 0) {
      return null;
    }

    let bestSupplier: BestPriceResult | null = null;

    for (const supplier of suppliers) {
      // Calculate adjusted quantity based on MOQ and order multiple
      let adjustedQty = Math.max(quantity, supplier.min_order_qty);

      // Round up to nearest order multiple
      if (supplier.order_multiple > 1) {
        adjustedQty = Math.ceil(adjustedQty / supplier.order_multiple) * supplier.order_multiple;
      }

      const totalCost = adjustedQty * supplier.unit_price;
      const meetsMinOrder = quantity >= supplier.min_order_qty;

      if (
        !bestSupplier ||
        totalCost < bestSupplier.total_cost ||
        (totalCost === bestSupplier.total_cost && supplier.is_preferred)
      ) {
        bestSupplier = {
          supplier,
          total_cost: totalCost,
          meets_moq: meetsMinOrder,
          adjusted_quantity: adjustedQty,
        };
      }
    }

    return bestSupplier;
  }

  // =====================================================
  // Get Supplier Products
  // =====================================================

  /**
   * Get all products for a specific supplier
   */
  static async getSupplierProducts(
    supabase: SupabaseClient<Database>,
    supplierId: string,
    activeOnly: boolean = true
  ): Promise<ProductSupplierWithRelations[]> {
    let query = supabase
      .from("product_suppliers")
      .select(
        `
        *,
        supplier:business_accounts!supplier_id (
          id,
          name,
          email,
          phone,
          is_active,
          address_line_1,
          address_line_2,
          city,
          state_province,
          postal_code,
          country
        ),
        product:products!product_id (
          id,
          name,
          sku,
          unit,
          description
        )
      `
      )
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("is_preferred", { ascending: false })
      .order("priority_rank", { ascending: true });

    if (activeOnly) {
      query = query.eq("is_active", true) as any;
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch supplier products: ${error.message}`);
    }

    return (data as any[]) || [];
  }

  // =====================================================
  // Create and Update
  // =====================================================

  /**
   * Add a new supplier to a product
   */
  static async addSupplier(
    supabase: SupabaseClient<Database>,
    productId: string,
    data: ProductSupplierFormData,
    userId: string
  ): Promise<any> {
    const insertData = {
      product_id: productId,
      supplier_id: data.supplier_id,
      supplier_sku: data.supplier_sku || null,
      supplier_product_name: data.supplier_product_name || null,
      supplier_product_description: data.supplier_product_description || null,
      unit_price: data.unit_price,
      currency_code: data.currency_code || "PLN",
      price_valid_from: data.price_valid_from || new Date().toISOString().split("T")[0],
      price_valid_until: data.price_valid_until || null,
      lead_time_days: data.lead_time_days ?? 0,
      min_order_qty: data.min_order_qty ?? 1,
      order_multiple: data.order_multiple ?? 1,
      is_preferred: data.is_preferred ?? false,
      is_active: data.is_active ?? true,
      priority_rank: data.priority_rank ?? 0,
      notes: data.notes || null,
      created_by: userId,
    };

    const { data: newSupplier, error } = await supabase
      .from("product_suppliers")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      // Check for duplicate supplier constraint
      if (
        error.code === "23505" &&
        error.message.includes("product_suppliers_product_id_supplier_id_key")
      ) {
        throw new Error("This supplier is already added to this product");
      }
      throw new Error(`Failed to add supplier: ${error.message}`);
    }

    // Create initial price history
    await this.createPriceHistory(
      supabase,
      newSupplier.id,
      data.unit_price,
      data.currency_code || "PLN",
      "Initial price",
      userId
    );

    return newSupplier;
  }

  /**
   * Update an existing product-supplier relationship
   */
  static async updateSupplier(
    supabase: SupabaseClient<Database>,
    id: string,
    data: Partial<ProductSupplierFormData>
  ): Promise<any> {
    // Sanitize data: convert empty strings to null
    const sanitizedData: any = {};
    Object.entries(data).forEach(([key, value]) => {
      // Skip system-managed timestamp fields
      if (
        key === "created_at" ||
        key === "deleted_at" ||
        key === "updated_at" ||
        key === "created_by"
      ) {
        return;
      }
      // Convert empty strings to null
      sanitizedData[key] = value === "" ? null : value;
    });

    const updateData: any = {
      ...sanitizedData,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from("product_suppliers")
      .update(updateData)
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update supplier: ${error.message}`);
    }

    return updated;
  }

  /**
   * Remove a supplier from a product (soft delete)
   */
  static async removeSupplier(supabase: SupabaseClient<Database>, id: string): Promise<void> {
    const { error } = await supabase
      .from("product_suppliers")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      throw new Error(`Failed to remove supplier: ${error.message}`);
    }
  }

  /**
   * Set a supplier as preferred (unsets others for this product)
   */
  static async setPreferredSupplier(
    supabase: SupabaseClient<Database>,
    productId: string,
    supplierId: string
  ): Promise<void> {
    // First, unset all preferred for this product
    const { error: unsetError } = await supabase
      .from("product_suppliers")
      .update({ is_preferred: false })
      .eq("product_id", productId)
      .is("deleted_at", null);

    if (unsetError) {
      throw new Error(`Failed to unset preferred suppliers: ${unsetError.message}`);
    }

    // Then set the new preferred supplier
    const { error: setError } = await supabase
      .from("product_suppliers")
      .update({ is_preferred: true })
      .eq("product_id", productId)
      .eq("supplier_id", supplierId)
      .is("deleted_at", null);

    if (setError) {
      throw new Error(`Failed to set preferred supplier: ${setError.message}`);
    }
  }

  // =====================================================
  // Price History
  // =====================================================

  /**
   * Update price (creates history record automatically via trigger)
   */
  static async updatePrice(
    supabase: SupabaseClient<Database>,
    id: string,
    newPrice: number,
    reason: string
  ): Promise<any> {
    const { data: updated, error } = await supabase
      .from("product_suppliers")
      .update({
        unit_price: newPrice,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update price: ${error.message}`);
    }

    // Update the reason in the price history record that was just created by trigger
    await supabase
      .from("product_supplier_price_history")
      .update({ change_reason: reason })
      .eq("product_supplier_id", id)
      .order("created_at", { ascending: false })
      .limit(1);

    return updated;
  }

  /**
   * Get price history for a product-supplier relationship
   */
  static async getPriceHistory(
    supabase: SupabaseClient<Database>,
    productSupplierId: string
  ): Promise<PriceHistoryResponse> {
    const { data, error } = await supabase
      .from("product_supplier_price_history")
      .select("*")
      .eq("product_supplier_id", productSupplierId)
      .order("effective_date", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch price history: ${error.message}`);
    }

    const history = (data as SupplierPriceHistory[]) || [];

    if (history.length === 0) {
      return {
        history: [],
        current_price: 0,
        price_trend: "stable",
        avg_price: 0,
      };
    }

    const currentPrice = history[0]?.unit_price || 0;
    const avgPrice = history.reduce((sum, h) => sum + h.unit_price, 0) / history.length;

    // Determine trend
    let priceTrend: "increasing" | "decreasing" | "stable" = "stable";
    if (history.length >= 2) {
      const recentPrice = history[0].unit_price;
      const previousPrice = history[1].unit_price;
      if (recentPrice > previousPrice) {
        priceTrend = "increasing";
      } else if (recentPrice < previousPrice) {
        priceTrend = "decreasing";
      }
    }

    return {
      history,
      current_price: currentPrice,
      price_trend: priceTrend,
      avg_price: avgPrice,
    };
  }

  /**
   * Create a price history record manually
   */
  private static async createPriceHistory(
    supabase: SupabaseClient<Database>,
    productSupplierId: string,
    unitPrice: number,
    currencyCode: string,
    reason: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase.from("product_supplier_price_history").insert({
      product_supplier_id: productSupplierId,
      unit_price: unitPrice,
      currency_code: currencyCode,
      effective_date: new Date().toISOString().split("T")[0],
      change_reason: reason,
      created_by: userId,
    });

    if (error) {
      console.error("Failed to create price history:", error);
      // Don't throw - price history is nice to have but not critical
    }
  }

  // =====================================================
  // Utility Methods
  // =====================================================

  /**
   * Check if a product has any suppliers
   */
  static async hasSuppliers(
    supabase: SupabaseClient<Database>,
    productId: string
  ): Promise<boolean> {
    const { count, error } = await supabase
      .from("product_suppliers")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to check suppliers: ${error.message}`);
    }

    return (count || 0) > 0;
  }

  /**
   * Get supplier count for a product
   */
  static async getSupplierCount(
    supabase: SupabaseClient<Database>,
    productId: string
  ): Promise<number> {
    const { count, error } = await supabase
      .from("product_suppliers")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to count suppliers: ${error.message}`);
    }

    return count || 0;
  }
}
