// =============================================
// Simplified Products Service
// Based on InFlow/Zoho inventory management
// =============================================

import { createClient } from "@/utils/supabase/client";
import type {
  ProductWithDetails,
  CreateProductFormData,
  UpdateProductFormData,
  ProductFilters,
  ProductListResponse,
  ProductBarcode,
  CreateProductBarcodeData,
} from "../types/products";

class ProductsService {
  private supabase = createClient();

  // ==========================================
  // PRODUCT CRUD OPERATIONS
  // ==========================================

  /**
   * Get all products with optional filtering
   */
  async getProducts(
    organizationId: string,
    filters?: ProductFilters
  ): Promise<ProductListResponse> {
    let query = this.supabase
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
    if (filters?.search) {
      query = query.or(
        `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
      );
    }

    if (filters?.product_type && filters.product_type.length > 0) {
      query = query.in("product_type", filters.product_type);
    }

    if (filters?.status && filters.status.length > 0) {
      query = query.in("status", filters.status);
    }

    if (filters?.category_id && filters.category_id.length > 0) {
      query = query.in("category_id", filters.category_id);
    }

    if (filters?.brand && filters.brand.length > 0) {
      query = query.in("brand", filters.brand);
    }

    if (filters?.manufacturer && filters.manufacturer.length > 0) {
      query = query.in("manufacturer", filters.manufacturer);
    }

    if (filters?.preferred_vendor_id && filters.preferred_vendor_id.length > 0) {
      query = query.in("preferred_vendor_id", filters.preferred_vendor_id);
    }

    if (filters?.min_price !== undefined) {
      query = query.gte("selling_price", filters.min_price);
    }

    if (filters?.max_price !== undefined) {
      query = query.lte("selling_price", filters.max_price);
    }

    // Pagination
    const limit = filters?.limit || 25;
    const offset = filters?.offset || 0;
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
      page: Math.floor(offset / limit) + 1,
      page_size: limit,
    };
  }

  /**
   * Get a single product by ID with all details
   */
  async getProductById(productId: string): Promise<ProductWithDetails | null> {
    const { data, error } = await this.supabase
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
  async createProduct(
    data: CreateProductFormData,
    organizationId: string,
    userId: string
  ): Promise<ProductWithDetails> {
    // 1. Create the main product
    const { data: product, error: productError } = await this.supabase
      .from("products")
      .insert({
        organization_id: organizationId,
        product_type: data.product_type,
        name: data.name,
        sku: data.sku || null,
        description: data.description || null,
        category_id: data.category_id || null,
        brand: data.brand || null,
        manufacturer: data.manufacturer || null,
        unit: data.unit || "pcs",
        returnable_item: data.returnable_item ?? true,
        dimensions_length: data.dimensions_length || null,
        dimensions_width: data.dimensions_width || null,
        dimensions_height: data.dimensions_height || null,
        dimensions_unit: data.dimensions_unit || null,
        weight: data.weight || null,
        weight_unit: data.weight_unit || null,
        upc: data.upc || null,
        ean: data.ean || null,
        isbn: data.isbn || null,
        mpn: data.mpn || null,
        selling_price: data.selling_price || 0,
        sales_account: data.sales_account || null,
        sales_description: data.sales_description || null,
        cost_price: data.cost_price || 0,
        purchase_account: data.purchase_account || null,
        purchase_description: data.purchase_description || null,
        preferred_vendor_id: data.preferred_vendor_id || null,
        track_inventory: data.track_inventory ?? true,
        inventory_account: data.inventory_account || null,
        reorder_point: data.reorder_point || 0,
        opening_stock: data.opening_stock || 0,
        opening_stock_rate: data.opening_stock_rate || null,
        status: "active",
        created_by: userId,
      })
      .select()
      .single();

    if (productError) {
      throw new Error(`Failed to create product: ${productError.message}`);
    }

    // 2. Create barcodes if provided
    if (data.barcodes && data.barcodes.length > 0) {
      const barcodeInserts = data.barcodes.map((b) => ({
        product_id: product.id,
        barcode: b.barcode,
        is_primary: b.is_primary,
      }));

      const { error: barcodeError } = await this.supabase
        .from("product_barcodes")
        .insert(barcodeInserts);

      if (barcodeError) {
        // Rollback product creation
        await this.supabase.from("products").delete().eq("id", product.id);
        throw new Error(`Failed to create barcodes: ${barcodeError.message}`);
      }
    }

    // 3. Create custom field values if provided
    if (data.custom_fields) {
      const customFieldInserts = Object.entries(data.custom_fields).map(([_key, fieldData]) => {
        const baseInsert: any = {
          product_id: product.id,
          field_definition_id: fieldData.field_definition_id,
        };

        // Set the appropriate value field based on type
        if (typeof fieldData.value === "string") {
          baseInsert.value_text = fieldData.value;
        } else if (typeof fieldData.value === "number") {
          baseInsert.value_number = fieldData.value;
        } else if (typeof fieldData.value === "boolean") {
          baseInsert.value_boolean = fieldData.value;
        }

        return baseInsert;
      });

      if (customFieldInserts.length > 0) {
        const { error: customFieldError } = await this.supabase
          .from("product_custom_field_values")
          .insert(customFieldInserts);

        if (customFieldError) {
          console.error("Failed to create custom fields:", customFieldError);
          // Don't rollback, just log the error
        }
      }
    }

    // 4. Fetch and return the complete product
    const createdProduct = await this.getProductById(product.id);
    if (!createdProduct) {
      throw new Error("Failed to fetch created product");
    }

    return createdProduct;
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId: string, data: UpdateProductFormData): Promise<ProductWithDetails> {
    const updateData: any = {};

    // Only include fields that are provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.sku !== undefined) updateData.sku = data.sku;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category_id !== undefined) updateData.category_id = data.category_id;
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.manufacturer !== undefined) updateData.manufacturer = data.manufacturer;
    if (data.unit !== undefined) updateData.unit = data.unit;
    if (data.returnable_item !== undefined) updateData.returnable_item = data.returnable_item;
    if (data.dimensions_length !== undefined) updateData.dimensions_length = data.dimensions_length;
    if (data.dimensions_width !== undefined) updateData.dimensions_width = data.dimensions_width;
    if (data.dimensions_height !== undefined) updateData.dimensions_height = data.dimensions_height;
    if (data.dimensions_unit !== undefined) updateData.dimensions_unit = data.dimensions_unit;
    if (data.weight !== undefined) updateData.weight = data.weight;
    if (data.weight_unit !== undefined) updateData.weight_unit = data.weight_unit;
    if (data.upc !== undefined) updateData.upc = data.upc;
    if (data.ean !== undefined) updateData.ean = data.ean;
    if (data.isbn !== undefined) updateData.isbn = data.isbn;
    if (data.mpn !== undefined) updateData.mpn = data.mpn;
    if (data.selling_price !== undefined) updateData.selling_price = data.selling_price;
    if (data.sales_account !== undefined) updateData.sales_account = data.sales_account;
    if (data.sales_description !== undefined) updateData.sales_description = data.sales_description;
    if (data.cost_price !== undefined) updateData.cost_price = data.cost_price;
    if (data.purchase_account !== undefined) updateData.purchase_account = data.purchase_account;
    if (data.purchase_description !== undefined)
      updateData.purchase_description = data.purchase_description;
    if (data.preferred_vendor_id !== undefined)
      updateData.preferred_vendor_id = data.preferred_vendor_id;
    if (data.track_inventory !== undefined) updateData.track_inventory = data.track_inventory;
    if (data.inventory_account !== undefined) updateData.inventory_account = data.inventory_account;
    if (data.reorder_point !== undefined) updateData.reorder_point = data.reorder_point;
    if (data.opening_stock !== undefined) updateData.opening_stock = data.opening_stock;
    if (data.opening_stock_rate !== undefined)
      updateData.opening_stock_rate = data.opening_stock_rate;

    const { error } = await this.supabase
      .from("products")
      .update(updateData)
      .eq("id", productId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product: ${error.message}`);
    }

    // Fetch and return the complete product
    const updatedProduct = await this.getProductById(productId);
    if (!updatedProduct) {
      throw new Error("Failed to fetch updated product");
    }

    return updatedProduct;
  }

  /**
   * Soft delete a product
   */
  async deleteProduct(productId: string): Promise<void> {
    const { error } = await this.supabase
      .from("products")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", productId);

    if (error) {
      throw new Error(`Failed to delete product: ${error.message}`);
    }
  }

  /**
   * Permanently delete a product
   */
  async permanentlyDeleteProduct(productId: string): Promise<void> {
    const { error } = await this.supabase.from("products").delete().eq("id", productId);

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
  async addBarcode(data: CreateProductBarcodeData): Promise<ProductBarcode> {
    const { data: barcode, error } = await this.supabase
      .from("product_barcodes")
      .insert({
        product_id: data.product_id || null,
        variant_id: data.variant_id || null,
        barcode: data.barcode,
        is_primary: data.is_primary,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add barcode: ${error.message}`);
    }

    return barcode;
  }

  /**
   * Remove a barcode
   */
  async removeBarcode(barcodeId: string): Promise<void> {
    const { error } = await this.supabase.from("product_barcodes").delete().eq("id", barcodeId);

    if (error) {
      throw new Error(`Failed to remove barcode: ${error.message}`);
    }
  }

  /**
   * Set a barcode as primary (unsets other primary barcodes for the same product/variant)
   */
  async setPrimaryBarcode(barcodeId: string, productId: string): Promise<void> {
    // First, unset all primary barcodes for this product
    await this.supabase
      .from("product_barcodes")
      .update({ is_primary: false })
      .eq("product_id", productId);

    // Then set the new primary
    const { error } = await this.supabase
      .from("product_barcodes")
      .update({ is_primary: true })
      .eq("id", barcodeId);

    if (error) {
      throw new Error(`Failed to set primary barcode: ${error.message}`);
    }
  }

  /**
   * Get all barcodes for a product
   */
  async getProductBarcodes(productId: string): Promise<ProductBarcode[]> {
    const { data, error } = await this.supabase
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

// Export singleton instance
export const productsService = new ProductsService();
export default productsService;
