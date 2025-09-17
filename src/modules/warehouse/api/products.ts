import { createClient } from "@/utils/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "../../../../supabase/types/types";
import type {
  ProductWithDetails,
  CreateProductData as FlexibleCreateProductData,
  UpdateProductData as FlexibleUpdateProductData,
} from "../types/flexible-products";

export type ProductWithVariants = ProductWithDetails;
export type { ProductWithDetails };

export type CreateProductData = FlexibleCreateProductData & {
  organization_id: string;
};

export type UpdateProductData = FlexibleUpdateProductData;

export class ProductService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
  }

  async createProduct(productData: CreateProductData): Promise<ProductWithVariants> {
    const {
      organization_id,
      template_id,
      name,
      description,
      status = "active",
      variant_name,
      variant_sku,
      variant_barcode,
      attributes = {},
      // images = [], // Not yet implemented
      // initial_stock // Not yet implemented
    } = productData;

    try {
      // 1. Create the main product
      const productInsert: TablesInsert<"products"> = {
        organization_id,
        template_id,
        name,
        slug: name.toLowerCase().replace(/\s+/g, "-"),
        description,
        status,
      };

      const { data: product, error: productError } = await this.supabase
        .from("products")
        .insert(productInsert)
        .select()
        .single();

      if (productError) throw productError;

      // 2. Create default variant
      const variantInsert: TablesInsert<"product_variants"> = {
        product_id: product.id,
        name: variant_name || name,
        slug: (variant_name || name).toLowerCase().replace(/\s+/g, "-"),
        sku: variant_sku,
        barcode: variant_barcode,
        is_default: true,
      };

      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .insert(variantInsert)
        .select()
        .single();

      if (variantError) throw variantError;

      // 3. Create product attributes
      if (Object.keys(attributes).length > 0) {
        const attributeInserts = Object.entries(attributes).map(([key, attributeValue]) => ({
          product_id: product.id,
          variant_id: variant.id,
          attribute_key: key,
          value_text: attributeValue.type === "text" ? attributeValue.value : null,
          value_number: attributeValue.type === "number" ? attributeValue.value : null,
          value_boolean: attributeValue.type === "boolean" ? attributeValue.value : null,
          value_date: attributeValue.type === "date" ? attributeValue.value : null,
          value_json: attributeValue.type === "json" ? attributeValue.value : null,
          context_scope: "warehouse",
        }));

        const { error: attributeError } = await this.supabase
          .from("product_attributes")
          .insert(attributeInserts);

        if (attributeError) throw attributeError;
      }

      // 4. Return the created product
      return await this.getProductById(product.id);
    } catch (error) {
      console.error("Error creating product:", error);
      throw error;
    }
  }

  async updateProduct(productData: UpdateProductData): Promise<ProductWithVariants> {
    const { id, name, description, status, attributes = {} } = productData;

    try {
      // 1. Update the main product
      const productUpdate: TablesUpdate<"products"> = {
        name,
        description,
        status,
      };

      const { error: productError } = await this.supabase
        .from("products")
        .update(productUpdate)
        .eq("id", id);

      if (productError) throw productError;

      // 2. Update attributes if provided
      if (Object.keys(attributes).length > 0) {
        // First delete existing attributes
        await this.supabase.from("product_attributes").delete().eq("product_id", id);

        // Then insert new attributes
        const attributeInserts = Object.entries(attributes).map(([key, attributeValue]) => ({
          product_id: id,
          attribute_key: key,
          value_text: attributeValue.type === "text" ? attributeValue.value : null,
          value_number: attributeValue.type === "number" ? attributeValue.value : null,
          value_boolean: attributeValue.type === "boolean" ? attributeValue.value : null,
          value_date: attributeValue.type === "date" ? attributeValue.value : null,
          value_json: attributeValue.type === "json" ? attributeValue.value : null,
          context_scope: "warehouse",
        }));

        const { error: attributeError } = await this.supabase
          .from("product_attributes")
          .insert(attributeInserts);

        if (attributeError) throw attributeError;
      }

      // 3. Fetch and return the updated product with relations
      return await this.getProductById(id);
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      // Soft delete by setting deleted_at timestamp
      const { error } = await this.supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", productId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  async getProductById(productId: string): Promise<ProductWithVariants> {
    try {
      const { data: product, error: productError } = await this.supabase
        .from("products")
        .select(
          `
          *,
          template:product_templates(*),
          variants:product_variants(
            *,
            attributes:product_attributes(*),
            images:product_images(*),
            stock_snapshots:stock_snapshots(*)
          ),
          attributes:product_attributes(*),
          images:product_images(*)
        `
        )
        .eq("id", productId)
        .is("deleted_at", null)
        .single();

      if (productError) throw productError;

      return product as ProductWithVariants;
    } catch (error) {
      console.error("Error getting product by ID:", error);
      throw error;
    }
  }

  async getProductsByBranch(
    branchId: string,
    filters?: {
      search?: string;
      minPrice?: number;
      maxPrice?: number;
      templateId?: string;
      locationId?: string;
      showLowStock?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ products: ProductWithVariants[]; total: number }> {
    try {
      let query = this.supabase
        .from("products")
        .select(
          `
          *,
          template:product_templates(*),
          variants:product_variants(
            *,
            attributes:product_attributes(*),
            images:product_images(*),
            stock_snapshots:stock_snapshots!inner(
              *,
              location:locations!inner(branch_id)
            )
          ),
          attributes:product_attributes(*),
          images:product_images(*)
        `,
          { count: "exact" }
        )
        .eq("variants.stock_snapshots.location.branch_id", branchId)
        .is("deleted_at", null);

      if (filters?.templateId) {
        query = query.eq("template_id", filters.templateId);
      }

      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters?.locationId) {
        query = query.eq("variants.stock_snapshots.location_id", filters.locationId);
      }

      if (filters?.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      const { data: products, error, count } = await query;
      if (error) throw error;

      return {
        products: (products || []) as ProductWithVariants[],
        total: count || 0,
      };
    } catch (error) {
      console.error("Error getting products by branch:", error);
      throw error;
    }
  }

  async updateProductStock(
    _productId: string,
    _variantId: string,
    _locationId: string,
    _quantity: number
  ): Promise<void> {
    try {
      // This would typically create a stock movement and update stock snapshots
      // For now, just a placeholder that would integrate with the movement system
      console.log("Stock update would be handled by the movement system");
    } catch (error) {
      console.error("Error updating product stock:", error);
      throw error;
    }
  }

  async getProductTemplates(organizationId: string): Promise<Tables<"product_templates">[]> {
    try {
      const { data, error } = await this.supabase
        .from("product_templates")
        .select("*")
        .or(`organization_id.eq.${organizationId},is_system.eq.true`)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting product templates:", error);
      throw error;
    }
  }

  async getLocationsByBranch(branchId: string): Promise<Tables<"locations">[]> {
    try {
      const { data, error } = await this.supabase
        .from("locations")
        .select("*")
        .eq("branch_id", branchId)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting locations by branch:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const productService = new ProductService();
