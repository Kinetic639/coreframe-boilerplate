import { createClient } from "@/utils/supabase/client";
import type {
  ProductTemplateWithAttributes,
  ProductWithDetails,
  CreateProductData,
  UpdateProductData,
  CreateVariantData,
  CreateMovementData,
  CreateReservationData,
  ProductSearchFilters,
  StockMovementFilters,
  AttributeValue,
  TemplateContext,
} from "../types/flexible-products";

export class FlexibleProductService {
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.supabase = createClient();
  }

  // ===== PRODUCT TEMPLATES =====

  async getProductTemplates(organizationId: string): Promise<ProductTemplateWithAttributes[]> {
    try {
      const { data, error } = await this.supabase
        .from("product_templates")
        .select(
          `
          *,
          attribute_definitions:template_attribute_definitions(*)
        `
        )
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("Error getting product templates:", error);
      throw error;
    }
  }

  async getProductTemplateById(id: string): Promise<ProductTemplateWithAttributes | null> {
    try {
      const { data, error } = await this.supabase
        .from("product_templates")
        .select(
          `
          *,
          attribute_definitions:template_attribute_definitions(*)
        `
        )
        .eq("id", id)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error getting product template:", error);
      throw error;
    }
  }

  // ===== FLEXIBLE PRODUCTS =====

  async createProduct(productData: CreateProductData): Promise<ProductWithDetails> {
    const {
      template_id,
      name,
      slug,
      description,
      status = "active",
      variant_name,
      variant_sku,
      variant_barcode,
      attributes = {},
      images = [],
      initial_stock,
    } = productData;

    try {
      // Start transaction
      const { data: product, error: productError } = await this.supabase
        .from("products")
        .insert({
          template_id,
          name,
          slug: slug || this.generateSlug(name),
          description,
          status,
          created_by: (await this.supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Create default variant
      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .insert({
          product_id: product.id,
          name: variant_name || name,
          slug: this.generateSlug(variant_name || name),
          sku: variant_sku,
          barcode: variant_barcode,
          is_default: true,
        })
        .select()
        .single();

      if (variantError) throw variantError;

      // Create product attributes
      if (Object.keys(attributes).length > 0) {
        await this.createProductAttributes(product.id, null, attributes, "warehouse");
      }

      // Create variant attributes if different from product attributes
      if (Object.keys(attributes).length > 0) {
        await this.createProductAttributes(product.id, variant.id, attributes, "warehouse");
      }

      // Create images
      if (images.length > 0) {
        await this.createProductImages(product.id, variant.id, images);
      }

      // Create initial stock movement if provided
      if (initial_stock && initial_stock.quantity > 0) {
        await this.createStockMovement({
          organization_id: product.organization_id,
          branch_id: initial_stock.location_id, // This should be resolved from location
          location_id: initial_stock.location_id,
          product_id: product.id,
          variant_id: variant.id,
          movement_type_code: "initial",
          quantity: initial_stock.quantity,
          unit_cost: initial_stock.unit_cost,
          notes: initial_stock.notes || "Initial stock entry",
        });
      }

      // Return complete product with all relations
      return await this.getProductById(product.id);
    } catch (error) {
      console.error("Error creating flexible product:", error);
      throw error;
    }
  }

  async getProductById(productId: string): Promise<ProductWithDetails> {
    try {
      const { data, error } = await this.supabase
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

      if (error) throw error;
      return data as ProductWithDetails;
    } catch (error) {
      console.error("Error getting product by ID:", error);
      throw error;
    }
  }

  async updateProduct(
    productId: string,
    updateData: UpdateProductData
  ): Promise<ProductWithDetails> {
    try {
      const { name, description, status, attributes, variant_sku, variant_barcode, variant_name } =
        updateData;

      // Update product
      const { error: productError } = await this.supabase
        .from("products")
        .update({
          name,
          description,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", productId);

      if (productError) throw productError;

      // Update default variant if variant data provided
      if (variant_name || variant_sku || variant_barcode) {
        const { error: variantError } = await this.supabase
          .from("product_variants")
          .update({
            name: variant_name,
            sku: variant_sku,
            barcode: variant_barcode,
            updated_at: new Date().toISOString(),
          })
          .eq("product_id", productId)
          .eq("is_default", true);

        if (variantError) throw variantError;
      }

      // Update attributes if provided
      if (attributes && Object.keys(attributes).length > 0) {
        await this.updateProductAttributes(productId, null, attributes, "warehouse");
      }

      // Return updated product
      return await this.getProductById(productId);
    } catch (error) {
      console.error("Error updating product:", error);
      throw error;
    }
  }

  async deleteProduct(productId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from("products")
        .update({
          deleted_at: new Date().toISOString(),
          status: "archived",
        })
        .eq("id", productId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting product:", error);
      throw error;
    }
  }

  async searchProducts(filters: ProductSearchFilters): Promise<{
    products: ProductWithDetails[];
    total: number;
  }> {
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
            stock_snapshots:stock_snapshots(*)
          ),
          attributes:product_attributes(*),
          images:product_images(*)
        `,
          { count: "exact" }
        )
        .is("deleted_at", null);

      // Apply filters
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.template_ids?.length) {
        query = query.in("template_id", filters.template_ids);
      }

      if (filters.status?.length) {
        query = query.in("status", filters.status);
      }

      if (filters.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      const { data: products, error, count } = await query;
      if (error) throw error;

      return {
        products: (products || []) as ProductWithDetails[],
        total: count || 0,
      };
    } catch (error) {
      console.error("Error searching products:", error);
      throw error;
    }
  }

  // ===== VARIANT MANAGEMENT =====

  async createVariant(variantData: CreateVariantData): Promise<ProductWithDetails> {
    try {
      const {
        product_id,
        name,
        slug,
        sku,
        barcode,
        is_default = false,
        attributes = {},
        images = [],
      } = variantData;

      // Create variant
      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .insert({
          product_id,
          name,
          slug: slug || this.generateSlug(name),
          sku,
          barcode,
          is_default,
        })
        .select()
        .single();

      if (variantError) throw variantError;

      // Create variant attributes
      if (Object.keys(attributes).length > 0) {
        await this.createProductAttributes(product_id, variant.id, attributes, "warehouse");
      }

      // Create variant images
      if (images.length > 0) {
        await this.createProductImages(product_id, variant.id, images);
      }

      // Return updated product with all variants
      return await this.getProductById(product_id);
    } catch (error) {
      console.error("Error creating variant:", error);
      throw error;
    }
  }

  async updateVariant(
    variantId: string,
    variantData: Partial<CreateVariantData>
  ): Promise<ProductWithDetails> {
    try {
      const {
        name,
        slug,
        sku,
        barcode,
        attributes,
        // images not yet implemented
      } = variantData;

      // Get the product_id for the variant
      const { data: variant, error: getError } = await this.supabase
        .from("product_variants")
        .select("product_id")
        .eq("id", variantId)
        .single();

      if (getError) throw getError;

      // Update variant
      const { error: updateError } = await this.supabase
        .from("product_variants")
        .update({
          name,
          slug: slug || (name ? this.generateSlug(name) : undefined),
          sku,
          barcode,
          updated_at: new Date().toISOString(),
        })
        .eq("id", variantId);

      if (updateError) throw updateError;

      // Update attributes if provided
      if (attributes && Object.keys(attributes).length > 0) {
        await this.updateProductAttributes(variant.product_id, variantId, attributes, "warehouse");
      }

      // Return updated product
      return await this.getProductById(variant.product_id);
    } catch (error) {
      console.error("Error updating variant:", error);
      throw error;
    }
  }

  async deleteVariant(variantId: string): Promise<void> {
    try {
      // Check if this is the default variant
      const { data: variant, error: checkError } = await this.supabase
        .from("product_variants")
        .select("product_id, is_default")
        .eq("id", variantId)
        .single();

      if (checkError) throw checkError;

      if (variant.is_default) {
        throw new Error("Cannot delete the default variant");
      }

      // Soft delete the variant
      const { error } = await this.supabase
        .from("product_variants")
        .update({
          deleted_at: new Date().toISOString(),
        })
        .eq("id", variantId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting variant:", error);
      throw error;
    }
  }

  // ===== CONTEXT-AWARE QUERIES =====

  async getProductsForContext(
    filters: ProductSearchFilters & { context: TemplateContext }
  ): Promise<{
    products: ProductWithDetails[];
    total: number;
  }> {
    try {
      // Build query for products with context-specific attributes
      let query = this.supabase
        .from("products")
        .select(
          `
          *,
          template:product_templates(*),
          variants:product_variants(
            *,
            attributes:product_attributes!inner(*)
          ),
          attributes:product_attributes!inner(*)
        `
        )
        .eq("attributes.context_scope", filters.context)
        .eq("variants.attributes.context_scope", filters.context)
        .is("deleted_at", null);

      // Apply other filters
      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
      }

      if (filters.template_ids && filters.template_ids.length > 0) {
        query = query.in("template_id", filters.template_ids);
      }

      if (filters.status && filters.status.length > 0) {
        query = query.in("status", filters.status);
      }

      if (filters.branch_id) {
        query = query.eq("organization_id", filters.branch_id);
      }

      const { data, error } = await query
        .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Get total count
      const { count, error: countError } = await this.supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .is("deleted_at", null);

      if (countError) throw countError;

      return {
        products: data as ProductWithDetails[],
        total: count || 0,
      };
    } catch (error) {
      console.error("Error getting products for context:", error);
      throw error;
    }
  }

  async getProductForContext(
    productId: string,
    context: TemplateContext
  ): Promise<ProductWithDetails | null> {
    try {
      const { data, error } = await this.supabase
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
        `
        )
        .eq("id", productId)
        .eq("attributes.context_scope", context)
        .eq("variants.attributes.context_scope", context)
        .is("deleted_at", null)
        .single();

      if (error) throw error;
      return data as ProductWithDetails;
    } catch (error) {
      console.error("Error getting product for context:", error);
      throw error;
    }
  }

  // ===== PRODUCT ATTRIBUTES =====

  private async createProductAttributes(
    productId: string,
    variantId: string | null,
    attributes: Record<string, AttributeValue>,
    context: TemplateContext
  ): Promise<void> {
    const attributeInserts = Object.entries(attributes).map(([key, value]) => ({
      product_id: productId,
      variant_id: variantId,
      attribute_key: key,
      context_scope: context,
      locale: "en", // Default locale, should be parameterized
      ...this.getAttributeValueColumns(value),
    }));

    const { error } = await this.supabase.from("product_attributes").insert(attributeInserts);

    if (error) throw error;
  }

  private async updateProductAttributes(
    productId: string,
    variantId: string | null,
    attributes: Record<string, AttributeValue>,
    context: TemplateContext
  ): Promise<void> {
    try {
      // Delete existing attributes for this product/variant/context
      const { error: deleteError } = await this.supabase
        .from("product_attributes")
        .delete()
        .eq("product_id", productId)
        .eq("variant_id", variantId)
        .eq("context_scope", context);

      if (deleteError) throw deleteError;

      // Create new attributes
      if (Object.keys(attributes).length > 0) {
        await this.createProductAttributes(productId, variantId, attributes, context);
      }
    } catch (error) {
      console.error("Error updating product attributes:", error);
      throw error;
    }
  }

  private getAttributeValueColumns(value: AttributeValue) {
    switch (value.type) {
      case "text":
        return { value_text: value.value };
      case "number":
        return { value_number: value.value };
      case "boolean":
        return { value_boolean: value.value };
      case "date":
        return { value_date: value.value };
      case "json":
        return { value_json: value.value };
      default:
        throw new Error(`Unknown attribute value type: ${(value as any).type}`);
    }
  }

  // ===== PRODUCT IMAGES =====

  private async createProductImages(
    productId: string,
    variantId: string | null,
    images: CreateProductData["images"]
  ): Promise<void> {
    if (!images?.length) return;

    const imageInserts = images.map((image, index) => ({
      product_id: productId,
      variant_id: variantId,
      storage_path: image.storage_path,
      file_name: image.file_name,
      alt_text: image.alt_text,
      display_order: index,
      context_scope: image.context_scope || "warehouse",
      is_primary: image.is_primary || index === 0,
    }));

    const { error } = await this.supabase.from("product_images").insert(imageInserts);

    if (error) throw error;
  }

  // ===== STOCK MOVEMENTS =====

  async createStockMovement(movementData: CreateMovementData): Promise<void> {
    try {
      const { error } = await this.supabase.from("stock_movements").insert({
        ...movementData,
        created_by: (await this.supabase.auth.getUser()).data.user?.id,
        occurred_at: new Date().toISOString(),
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error creating stock movement:", error);
      throw error;
    }
  }

  async getStockMovements(filters: StockMovementFilters): Promise<{
    movements: any[];
    total: number;
  }> {
    try {
      let query = this.supabase.from("stock_movements").select(
        `
          *,
          movement_type:movement_types(*),
          product:products(*),
          variant:product_variants(*),
          location:locations(*),
          created_by_user:users(*)
        `,
        { count: "exact" }
      );

      // Apply filters
      if (filters.product_id) {
        query = query.eq("product_id", filters.product_id);
      }

      if (filters.variant_id) {
        query = query.eq("variant_id", filters.variant_id);
      }

      if (filters.location_id) {
        query = query.eq("location_id", filters.location_id);
      }

      if (filters.branch_id) {
        query = query.eq("branch_id", filters.branch_id);
      }

      if (filters.movement_types?.length) {
        query = query.in("movement_type_code", filters.movement_types);
      }

      if (filters.date_from) {
        query = query.gte("occurred_at", filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte("occurred_at", filters.date_to);
      }

      if (filters.limit) {
        query = query.range(filters.offset || 0, (filters.offset || 0) + filters.limit - 1);
      }

      query = query.order("occurred_at", { ascending: false });

      const { data: movements, error, count } = await query;
      if (error) throw error;

      return {
        movements: movements || [],
        total: count || 0,
      };
    } catch (error) {
      console.error("Error getting stock movements:", error);
      throw error;
    }
  }

  // ===== STOCK RESERVATIONS =====

  async createReservation(reservationData: CreateReservationData): Promise<void> {
    try {
      const { error } = await this.supabase.from("stock_reservations").insert({
        ...reservationData,
        created_by: (await this.supabase.auth.getUser()).data.user?.id,
        status: "active",
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error creating stock reservation:", error);
      throw error;
    }
  }

  // ===== UTILITY METHODS =====

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "") +
      "-" +
      Date.now().toString(36)
    );
  }

  async calculateCurrentStock(
    organizationId: string,
    branchId: string,
    locationId: string,
    productId: string,
    variantId: string
  ): Promise<{ onHand: number; reserved: number; available: number }> {
    try {
      // Get from snapshot first (faster)
      const { data: snapshot } = await this.supabase
        .from("stock_snapshots")
        .select("quantity_on_hand, quantity_reserved, quantity_available")
        .eq("organization_id", organizationId)
        .eq("branch_id", branchId)
        .eq("location_id", locationId)
        .eq("product_id", productId)
        .eq("variant_id", variantId)
        .single();

      if (snapshot) {
        return {
          onHand: snapshot.quantity_on_hand,
          reserved: snapshot.quantity_reserved,
          available: snapshot.quantity_available,
        };
      }

      // Fallback to real-time calculation if no snapshot
      return { onHand: 0, reserved: 0, available: 0 };
    } catch (error) {
      console.error("Error calculating current stock:", error);
      return { onHand: 0, reserved: 0, available: 0 };
    }
  }
}

// Export singleton instance
export const flexibleProductService = new FlexibleProductService();
