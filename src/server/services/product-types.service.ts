import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateProductTypeInput,
  UpdateProductTypeInput,
} from "@/server/schemas/product-types.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type ProductType = Database["public"]["Tables"]["product_types"]["Row"];

// ==========================================
// PRODUCT TYPES SERVICE
// ==========================================

export class ProductTypesService {
  /**
   * Get all product types for an organization
   */
  static async getProductTypes(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<ProductType[]> {
    const { data, error } = await supabase
      .from("product_types")
      .select("*")
      .eq("organization_id", organizationId)
      .order("name");

    if (error) {
      throw new Error(`Failed to fetch product types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single product type by ID
   */
  static async getProductType(
    supabase: SupabaseClient<Database>,
    productTypeId: string
  ): Promise<ProductType | null> {
    const { data, error } = await supabase
      .from("product_types")
      .select("*")
      .eq("id", productTypeId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch product type: ${error.message}`);
    }

    return data;
  }

  /**
   * Get a product type by slug
   */
  static async getProductTypeBySlug(
    supabase: SupabaseClient<Database>,
    slug: string,
    organizationId: string
  ): Promise<ProductType | null> {
    const { data, error } = await supabase
      .from("product_types")
      .select("*")
      .eq("slug", slug)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch product type by slug: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new product type
   */
  static async createProductType(
    supabase: SupabaseClient<Database>,
    input: CreateProductTypeInput
  ): Promise<ProductType> {
    // Check if slug already exists for this organization
    const existing = await this.getProductTypeBySlug(supabase, input.slug, input.organization_id);

    if (existing) {
      throw new Error(`Product type with slug "${input.slug}" already exists`);
    }

    const { data, error } = await supabase
      .from("product_types")
      .insert({
        organization_id: input.organization_id,
        name: input.name,
        slug: input.slug,
        icon: input.icon || null,
      } as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create product type: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a product type
   */
  static async updateProductType(
    supabase: SupabaseClient<Database>,
    productTypeId: string,
    input: UpdateProductTypeInput
  ): Promise<ProductType> {
    // If slug is being updated, check if it already exists
    if (input.slug) {
      const { data: existing } = await supabase
        .from("product_types")
        .select("id, organization_id")
        .eq("slug", input.slug)
        .single();

      if (existing && existing.id !== productTypeId) {
        throw new Error(`Product type with slug "${input.slug}" already exists`);
      }
    }

    const { data, error } = await supabase
      .from("product_types")
      .update(input as any)
      .eq("id", productTypeId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update product type: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a product type
   */
  static async deleteProductType(
    supabase: SupabaseClient<Database>,
    productTypeId: string
  ): Promise<void> {
    const { error } = await supabase.from("product_types").delete().eq("id", productTypeId);

    if (error) {
      throw new Error(`Failed to delete product type: ${error.message}`);
    }
  }
}
