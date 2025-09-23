import { createClient } from "@/utils/supabase/client";
import type {
  ProductWithVariants,
  Variant,
  CreateVariantData,
  UpdateVariantData,
  VariantFilters,
  VariantsResponse,
} from "../types/variant-types";

export class ProductService {
  private supabase = createClient();

  // ===== PRODUCT OPERATIONS =====

  async getProduct(productId: string): Promise<ProductWithVariants | null> {
    try {
      const { data, error } = await this.supabase
        .from("products")
        .select(
          `
          *,
          template:product_templates(*),
          variants:product_variants(
            id,
            product_id,
            name,
            slug,
            sku,
            barcode,
            is_default,
            status,
            created_at,
            updated_at
          )
        `
        )
        .eq("id", productId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;

      // Transform the data to include simplified attributes
      const productWithVariants: ProductWithVariants = {
        ...data,
        variants: await this.enrichVariantsWithAttributes(data.variants || []),
      };

      return productWithVariants;
    } catch (error) {
      console.error("Error getting product:", error);
      throw error;
    }
  }

  // ===== VARIANT OPERATIONS =====

  async getVariants(productId: string, filters?: VariantFilters): Promise<VariantsResponse> {
    try {
      let query = this.supabase
        .from("product_variants")
        .select("*", { count: "exact" })
        .eq("product_id", productId)
        .is("deleted_at", null);

      // Apply simple filters
      if (filters?.search) {
        query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%`);
      }

      if (filters?.status?.length) {
        query = query.in("status", filters.status);
      }

      const {
        data: variantData,
        error,
        count,
      } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Enrich with attributes
      const variants = await this.enrichVariantsWithAttributes(variantData || []);

      return {
        variants,
        total: count || 0,
      };
    } catch (error) {
      console.error("Error getting variants:", error);
      throw error;
    }
  }

  async getVariant(variantId: string): Promise<Variant | null> {
    try {
      const { data, error } = await this.supabase
        .from("product_variants")
        .select("*")
        .eq("id", variantId)
        .is("deleted_at", null)
        .single();

      if (error) throw error;

      // Enrich with attributes
      const [enrichedVariant] = await this.enrichVariantsWithAttributes([data]);
      return enrichedVariant;
    } catch (error) {
      console.error("Error getting variant:", error);
      throw error;
    }
  }

  async createVariant(productId: string, variantData: CreateVariantData): Promise<Variant> {
    try {
      // Create the variant record
      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .insert({
          product_id: productId,
          name: variantData.name,
          slug: this.generateSlug(variantData.name),
          sku: variantData.sku,
          barcode: variantData.barcode,
          is_default: false,
          status: "active",
        })
        .select()
        .single();

      if (variantError) throw variantError;

      // Create attributes if provided
      if (variantData.attributes && Object.keys(variantData.attributes).length > 0) {
        await this.createVariantAttributes(productId, variant.id, variantData.attributes);
      }

      // Return the enriched variant
      const [enrichedVariant] = await this.enrichVariantsWithAttributes([variant]);
      return enrichedVariant;
    } catch (error) {
      console.error("Error creating variant:", error);
      throw error;
    }
  }

  async updateVariant(variantId: string, variantData: UpdateVariantData): Promise<Variant> {
    try {
      // Update the variant record
      const updateData: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (variantData.name) {
        updateData.name = variantData.name;
        updateData.slug = this.generateSlug(variantData.name);
      }
      if (variantData.sku !== undefined) updateData.sku = variantData.sku;
      if (variantData.barcode !== undefined) updateData.barcode = variantData.barcode;

      const { data: variant, error: variantError } = await this.supabase
        .from("product_variants")
        .update(updateData)
        .eq("id", variantId)
        .select()
        .single();

      if (variantError) throw variantError;

      // Update attributes if provided
      if (variantData.attributes) {
        await this.updateVariantAttributes(variant.product_id, variantId, variantData.attributes);
      }

      // Return the enriched variant
      const [enrichedVariant] = await this.enrichVariantsWithAttributes([variant]);
      return enrichedVariant;
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
        .select("is_default")
        .eq("id", variantId)
        .single();

      if (checkError) throw checkError;

      if (variant.is_default) {
        throw new Error("Cannot delete the default variant");
      }

      // Soft delete
      const { error } = await this.supabase
        .from("product_variants")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", variantId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting variant:", error);
      throw error;
    }
  }

  // ===== HELPER METHODS =====

  private async enrichVariantsWithAttributes(variants: unknown[]): Promise<Variant[]> {
    if (variants.length === 0) return [];

    const variantIds = (variants as { id: string }[]).map((v) => v.id);

    // Get all attributes for these variants
    const { data: attributes } = await this.supabase
      .from("product_attributes")
      .select("variant_id, attribute_key, value_text, value_number")
      .in("variant_id", variantIds);

    // Group attributes by variant
    const attributesByVariant = (attributes || []).reduce(
      (acc, attr) => {
        if (!acc[attr.variant_id]) {
          acc[attr.variant_id] = {};
        }
        // Simple attribute value extraction
        const value = attr.value_text ?? attr.value_number ?? null;
        if (value !== null) {
          acc[attr.variant_id][attr.attribute_key] = value;
        }
        return acc;
      },
      {} as Record<string, Record<string, string | number>>
    );

    // Enrich variants with attributes and get stock info
    return Promise.all(
      (variants as any[]).map(async (variant) => ({
        id: variant.id,
        product_id: variant.product_id,
        name: variant.name,
        slug: variant.slug,
        sku: variant.sku,
        barcode: variant.barcode,
        is_default: variant.is_default,
        status: variant.status,
        attributes: attributesByVariant[variant.id] || {},
        stock_quantity: await this.getVariantStockQuantity(variant.id),
        created_at: variant.created_at,
        updated_at: variant.updated_at,
      }))
    );
  }

  private async createVariantAttributes(
    productId: string,
    variantId: string,
    attributes: Record<string, string | number>
  ): Promise<void> {
    const attributeInserts = Object.entries(attributes).map(([key, value]) => ({
      product_id: productId,
      variant_id: variantId,
      attribute_key: key,
      context_scope: "warehouse",
      locale: "en",
      ...(typeof value === "string" ? { value_text: value } : { value_number: value }),
    }));

    const { error } = await this.supabase.from("product_attributes").insert(attributeInserts);

    if (error) throw error;
  }

  private async updateVariantAttributes(
    productId: string,
    variantId: string,
    attributes: Record<string, string | number>
  ): Promise<void> {
    // Delete existing attributes
    await this.supabase.from("product_attributes").delete().eq("variant_id", variantId);

    // Create new ones
    if (Object.keys(attributes).length > 0) {
      await this.createVariantAttributes(productId, variantId, attributes);
    }
  }

  private async getVariantStockQuantity(variantId: string): Promise<number> {
    try {
      const { data } = await this.supabase
        .from("stock_snapshots")
        .select("quantity_on_hand")
        .eq("variant_id", variantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return data?.quantity_on_hand || 0;
    } catch {
      return 0;
    }
  }

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
}

// Export singleton instance
export const productService = new ProductService();
