// =============================================
// Products Service (Server-side)
// Migrated from src/modules/warehouse/api/products-service.ts
// =============================================

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateProductInput,
  UpdateProductInput,
  ProductFilters,
} from "@/server/schemas/products.schema";

type Product = Database["public"]["Tables"]["products"]["Row"];
type ProductBarcode = Database["public"]["Tables"]["product_barcodes"]["Row"];

export interface ProductWithDetails extends Product {
  barcodes?: ProductBarcode[];
  custom_field_values?: any[];
  category?: any;
  variants?: any[];
  images?: any[];
}

export interface ProductListResponse {
  products: ProductWithDetails[];
  total_count: number;
  page: number;
  page_size: number;
}

export class ProductsService {
  /**
   * Get all products with optional filtering
   */
  static async getProducts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    filters: ProductFilters
  ): Promise<ProductListResponse> {
    let query = supabase
      .from("products")
      .select(
        `
        *,
        barcodes:product_barcodes(*),
        custom_field_values:product_custom_field_values(*),
        category:product_categories(*),
        variants:product_variants(count),
        images:product_images(*)
      `,
        { count: "exact" }
      )
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    // Apply filters
    if (filters.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters.product_type && filters.product_type.length > 0) {
      query = query.in("product_type", filters.product_type);
    }

    if (filters.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters.category_id && filters.category_id.length > 0) {
      query = query.in("category_id", filters.category_id);
    }

    if (filters.brand && filters.brand.length > 0) {
      query = query.in("brand", filters.brand);
    }

    if (filters.manufacturer && filters.manufacturer.length > 0) {
      query = query.in("manufacturer", filters.manufacturer);
    }

    if (filters.min_price !== undefined) {
      query = query.gte("selling_price", filters.min_price);
    }

    if (filters.max_price !== undefined) {
      query = query.lte("selling_price", filters.max_price);
    }

    // Pagination
    const limit = filters.pageSize;
    const offset = filters.offset || (filters.page - 1) * filters.pageSize;
    query = query.range(offset, offset + limit - 1);

    // Order by
    query = query.order("created_at", { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch products: ${error.message}`);
    }

    return {
      products: data || [],
      total_count: count || 0,
      page: filters.page,
      page_size: limit,
    };
  }

  /**
   * Get a single product by ID with all details
   */
  static async getProductById(
    supabase: SupabaseClient<Database>,
    productId: string
  ): Promise<ProductWithDetails | null> {
    const { data, error } = await supabase
      .from("products")
      .select(
        `
        *,
        barcodes:product_barcodes(*),
        custom_field_values:product_custom_field_values(*),
        category:product_categories(*),
        variants:product_variants(*),
        images:product_images(*)
      `
      )
      .eq("id", productId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null; // Not found
      }
      throw new Error(`Failed to fetch product: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new product (goods or service)
   */
  static async createProduct(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    userId: string,
    input: CreateProductInput
  ): Promise<ProductWithDetails> {
    // 1. Create the main product
    const { data: product, error: productError } = await supabase
      .from("products")
      .insert({
        organization_id: organizationId,
        product_type: input.product_type,
        name: input.name,
        sku: input.sku,
        description: input.description,
        category_id: input.category_id,
        brand: input.brand,
        manufacturer: input.manufacturer,
        unit: input.unit,
        returnable_item: input.returnable_item,
        dimensions_length: input.dimensions_length,
        dimensions_width: input.dimensions_width,
        dimensions_height: input.dimensions_height,
        dimensions_unit: input.dimensions_unit,
        weight: input.weight,
        weight_unit: input.weight_unit,
        upc: input.upc,
        ean: input.ean,
        isbn: input.isbn,
        mpn: input.mpn,
        selling_price: input.selling_price,
        sales_account: input.sales_account,
        sales_description: input.sales_description,
        cost_price: input.cost_price,
        purchase_account: input.purchase_account,
        purchase_description: input.purchase_description,
        preferred_vendor_id: input.preferred_vendor_id,
        track_inventory: input.track_inventory,
        inventory_account: input.inventory_account,
        reorder_point: input.reorder_point,
        opening_stock: input.opening_stock,
        opening_stock_rate: input.opening_stock_rate,
        reorder_quantity: input.reorder_quantity,
        max_stock_level: input.max_stock_level,
        reorder_calculation_method: input.reorder_calculation_method,
        lead_time_days: input.lead_time_days,
        send_low_stock_alerts: input.send_low_stock_alerts,
        status: input.status,
        created_by: userId,
      } as any)
      .select()
      .single();

    if (productError) {
      throw new Error(`Failed to create product: ${productError.message}`);
    }

    // 2. Fetch and return the complete product
    const createdProduct = await this.getProductById(supabase, product.id);
    if (!createdProduct) {
      throw new Error("Failed to fetch created product");
    }

    return createdProduct;
  }

  /**
   * Update an existing product
   */
  static async updateProduct(
    supabase: SupabaseClient<Database>,
    productId: string,
    input: UpdateProductInput
  ): Promise<ProductWithDetails> {
    const { error } = await supabase
      .from("products")
      .update(input as any)
      .eq("id", productId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }

    // Fetch and return the complete product
    const updatedProduct = await this.getProductById(supabase, productId);
    if (!updatedProduct) {
      throw new Error("Failed to fetch updated product");
    }

    return updatedProduct;
  }

  /**
   * Soft delete a product
   */
  static async deleteProduct(supabase: SupabaseClient<Database>, productId: string): Promise<void> {
    const { error } = await supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", productId);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  /**
   * Permanently delete a product
   */
  static async permanentlyDeleteProduct(
    supabase: SupabaseClient<Database>,
    productId: string
  ): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", productId);

    if (error) {
      throw new Error(`Failed to permanently delete product: ${error.message}`);
    }
  }

  // ==========================================
  // BARCODE OPERATIONS
  // ==========================================

  /**
   * Add a barcode to a product
   */
  static async addBarcode(
    supabase: SupabaseClient<Database>,
    productId: string | null,
    variantId: string | null,
    barcode: string,
    isPrimary: boolean
  ): Promise<ProductBarcode> {
    const { data, error } = await supabase
      .from("product_barcodes")
      .insert({
        product_id: productId,
        variant_id: variantId,
        barcode,
        is_primary: isPrimary,
      } as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add barcode: ${error.message}`);
    }

    return data;
  }

  /**
   * Remove a barcode
   */
  static async removeBarcode(supabase: SupabaseClient<Database>, barcodeId: string): Promise<void> {
    const { error } = await supabase.from("product_barcodes").delete().eq("id", barcodeId);

    if (error) {
      throw new Error(`Failed to remove barcode: ${error.message}`);
    }
  }

  /**
   * Set a barcode as primary
   */
  static async setPrimaryBarcode(
    supabase: SupabaseClient<Database>,
    barcodeId: string,
    productId: string
  ): Promise<void> {
    // First, unset all primary barcodes for this product
    await supabase
      .from("product_barcodes")
      .update({ is_primary: false } as any)
      .eq("product_id", productId);

    // Then set the new primary
    const { error } = await supabase
      .from("product_barcodes")
      .update({ is_primary: true } as any)
      .eq("id", barcodeId);

    if (error) {
      throw new Error(`Failed to set primary barcode: ${error.message}`);
    }
  }

  /**
   * Get all barcodes for a product
   */
  static async getProductBarcodes(
    supabase: SupabaseClient<Database>,
    productId: string
  ): Promise<ProductBarcode[]> {
    const { data, error } = await supabase
      .from("product_barcodes")
      .select("*")
      .eq("product_id", productId)
      .order("is_primary", { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch barcodes: ${error.message}`);
    }

    return data || [];
  }
}
