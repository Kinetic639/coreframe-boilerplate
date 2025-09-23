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

  /**
   * Save a product configuration as a template for future use
   */
  async saveProductAsTemplate(
    productId: string,
    templateData: {
      name: string;
      description?: string;
      organization_id: string;
      category?: string;
      icon?: string;
      color?: string;
    }
  ): Promise<Tables<"product_templates">> {
    try {
      // 1. Get the product with its attributes
      const product = await this.getProductById(productId);

      // 2. Create the template
      const templateInsert: TablesInsert<"product_templates"> = {
        name: templateData.name,
        slug: templateData.name.toLowerCase().replace(/\s+/g, "-"),
        description: templateData.description,
        organization_id: templateData.organization_id,
        category: templateData.category || "custom",
        icon: templateData.icon || "Package",
        color: templateData.color || "#10b981",
        is_system: false,
        metadata: {
          contexts: ["warehouse"],
          settings: {},
          source_product_id: productId,
        },
      };

      const { data: template, error: templateError } = await this.supabase
        .from("product_templates")
        .insert(templateInsert)
        .select()
        .single();

      if (templateError) throw templateError;

      // 3. Create attribute definitions from product attributes
      const productAttributes = product.attributes || [];

      if (productAttributes.length > 0) {
        const attributeDefinitions = productAttributes.map((attr, index) => ({
          template_id: template.id,
          slug: attr.attribute_key,
          label: { en: attr.attribute_key, pl: attr.attribute_key },
          description: {
            en: `Attribute: ${attr.attribute_key}`,
            pl: `Atrybut: ${attr.attribute_key}`,
          },
          data_type: this.inferDataType(attr),
          is_required: false,
          is_unique: false,
          default_value: this.getAttributeValue(attr),
          validation_rules: {},
          context_scope: attr.context_scope || "warehouse",
          display_order: index,
          is_searchable: true,
          is_filterable: false,
          input_type: "text",
          context_behavior: "context_specific",
          api_visibility: { public: false, token_required: false, private: true },
        }));

        const { error: attributeError } = await this.supabase
          .from("template_attribute_definitions")
          .insert(attributeDefinitions);

        if (attributeError) throw attributeError;
      }

      return template;
    } catch (error) {
      console.error("Error saving product as template:", error);
      throw error;
    }
  }

  /**
   * Helper to infer data type from product attribute
   */
  private inferDataType(attr: Tables<"product_attributes">): string {
    if (attr.value_text !== null) return "text";
    if (attr.value_number !== null) return "number";
    if (attr.value_boolean !== null) return "boolean";
    if (attr.value_date !== null) return "date";
    if (attr.value_json !== null) return "json";
    return "text"; // default
  }

  /**
   * Helper to get attribute value for template default
   */
  private getAttributeValue(attr: Tables<"product_attributes">): any {
    if (attr.value_text !== null) return attr.value_text;
    if (attr.value_number !== null) return attr.value_number;
    if (attr.value_boolean !== null) return attr.value_boolean;
    if (attr.value_date !== null) return attr.value_date;
    if (attr.value_json !== null) return attr.value_json;
    return null;
  }

  /**
   * Get product data filtered by context
   */
  async getProductByContext(
    productId: string,
    context: string = "warehouse"
  ): Promise<ProductWithVariants> {
    try {
      const { data: product, error: productError } = await this.supabase
        .from("products")
        .select(
          `
          *,
          template:product_templates(*),
          variants:product_variants(
            *,
            attributes:product_attributes!inner(*),
            images:product_images!inner(*),
            stock_snapshots:stock_snapshots(*)
          ),
          attributes:product_attributes!inner(*),
          images:product_images!inner(*)
        `
        )
        .eq("id", productId)
        .eq("attributes.context_scope", context)
        .eq("variants.attributes.context_scope", context)
        .eq("variants.images.context_scope", context)
        .eq("images.context_scope", context)
        .is("deleted_at", null)
        .single();

      if (productError) throw productError;

      return product as ProductWithVariants;
    } catch (error) {
      console.error("Error getting product by context:", error);
      throw error;
    }
  }

  /**
   * Update product attributes in a specific context
   */
  async updateProductInContext(
    productId: string,
    context: string,
    data: {
      attributes?: Record<string, any>;
      images?: any[];
    }
  ): Promise<void> {
    try {
      // Update context-specific attributes
      if (data.attributes && Object.keys(data.attributes).length > 0) {
        // Delete existing attributes for this context
        await this.supabase
          .from("product_attributes")
          .delete()
          .eq("product_id", productId)
          .eq("context_scope", context);

        // Insert new attributes for this context
        const attributeInserts = Object.entries(data.attributes).map(([key, value]) => ({
          product_id: productId,
          attribute_key: key,
          value_text: typeof value === "string" ? value : null,
          value_number: typeof value === "number" ? value : null,
          value_boolean: typeof value === "boolean" ? value : null,
          value_date: value instanceof Date ? value.toISOString() : null,
          value_json: typeof value === "object" && value !== null ? value : null,
          context_scope: context,
        }));

        const { error: attributeError } = await this.supabase
          .from("product_attributes")
          .insert(attributeInserts);

        if (attributeError) throw attributeError;
      }

      // Update context-specific images
      if (data.images && data.images.length > 0) {
        // Delete existing images for this context
        await this.supabase
          .from("product_images")
          .delete()
          .eq("product_id", productId)
          .eq("context_scope", context);

        // Insert new images for this context
        const imageInserts = data.images.map((image, index) => ({
          product_id: productId,
          storage_path: image.storage_path,
          file_name: image.file_name,
          alt_text: image.alt_text,
          display_order: index,
          context_scope: context,
          is_primary: image.is_primary || false,
          metadata: image.metadata || {},
        }));

        const { error: imageError } = await this.supabase
          .from("product_images")
          .insert(imageInserts);

        if (imageError) throw imageError;
      }
    } catch (error) {
      console.error("Error updating product in context:", error);
      throw error;
    }
  }

  /**
   * Get products filtered by context
   */
  async getProductsForContext(
    context: string,
    filters: {
      organizationId?: string;
      branchId?: string;
      search?: string;
      limit?: number;
      offset?: number;
    } = {}
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
            attributes:product_attributes!inner(*),
            images:product_images(*),
            stock_snapshots:stock_snapshots(*)
          ),
          attributes:product_attributes!inner(*),
          images:product_images(*)
        `,
          { count: "exact" }
        )
        .eq("attributes.context_scope", context)
        .eq("variants.attributes.context_scope", context)
        .is("deleted_at", null);

      if (filters.organizationId) {
        query = query.eq("organization_id", filters.organizationId);
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      const { data: products, error, count } = await query;
      if (error) throw error;

      return {
        products: (products || []) as ProductWithVariants[],
        total: count || 0,
      };
    } catch (error) {
      console.error("Error getting products for context:", error);
      throw error;
    }
  }

  /**
   * Copy product data from one context to another
   */
  async copyProductToContext(
    productId: string,
    sourceContext: string,
    targetContext: string,
    overrides?: {
      attributes?: Record<string, any>;
      images?: any[];
    }
  ): Promise<void> {
    try {
      // Get source context data
      const sourceProduct = await this.getProductByContext(productId, sourceContext);

      // Prepare target context data
      const targetAttributes = overrides?.attributes || {};
      const targetImages = overrides?.images || [];

      // Copy attributes from source if not overridden
      sourceProduct.attributes.forEach((attr) => {
        if (!targetAttributes[attr.attribute_key]) {
          targetAttributes[attr.attribute_key] = this.getAttributeValue(attr);
        }
      });

      // Copy images from source if not overridden
      if (targetImages.length === 0) {
        sourceProduct.images.forEach((image) => {
          targetImages.push({
            storage_path: image.storage_path,
            file_name: image.file_name,
            alt_text: image.alt_text,
            is_primary: image.is_primary,
            metadata: image.metadata,
          });
        });
      }

      // Update target context
      await this.updateProductInContext(productId, targetContext, {
        attributes: targetAttributes,
        images: targetImages,
      });
    } catch (error) {
      console.error("Error copying product to context:", error);
      throw error;
    }
  }
}

// Export a singleton instance
export const productService = new ProductService();
