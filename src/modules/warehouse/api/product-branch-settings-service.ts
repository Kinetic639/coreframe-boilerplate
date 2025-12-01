import { createClient } from "@/lib/supabase/client";
import type {
  ProductBranchSettings,
  CreateProductBranchSettingsData,
  UpdateProductBranchSettingsData,
  ProductWithBranchSettings,
} from "../types/product-branch-settings";

export const productBranchSettingsService = {
  /**
   * Get settings for a product in a specific branch
   */
  async getSettings(productId: string, branchId: string): Promise<ProductBranchSettings | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .select("*")
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .single();

    if (error) {
      console.error("Error fetching product branch settings:", error);
      return null;
    }

    return data;
  },

  /**
   * Get all branch settings for a product (all warehouses)
   */
  async getSettingsForProduct(productId: string): Promise<ProductBranchSettings[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .select("*")
      .eq("product_id", productId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching product branch settings:", error);
      return [];
    }

    return data || [];
  },

  /**
   * Get all products with settings for a specific branch
   */
  async getProductsForBranch(
    branchId: string,
    organizationId: string
  ): Promise<ProductWithBranchSettings[]> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .select(
        `
        *,
        products!inner(id, name, sku),
        branches!inner(id, name)
      `
      )
      .eq("branch_id", branchId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .is("products.deleted_at", null)
      .is("branches.deleted_at", null);

    if (error) {
      console.error("Error fetching products for branch:", error);
      return [];
    }

    return (
      data?.map((item: any) => ({
        product_id: item.product_id,
        product_name: item.products.name,
        product_sku: item.products.sku,
        branch_id: item.branch_id,
        branch_name: item.branches.name,
        settings: item,
      })) || []
    );
  },

  /**
   * Create or update settings for a product in a branch
   */
  async upsertSettings(
    data: CreateProductBranchSettingsData
  ): Promise<ProductBranchSettings | null> {
    const supabase = createClient();

    const { data: result, error } = await supabase
      .from("product_branch_settings")
      .upsert(
        {
          ...data,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "product_id,branch_id",
        }
      )
      .select()
      .single();

    if (error) {
      console.error("Error upserting product branch settings:", error);
      throw error;
    }

    return result;
  },

  /**
   * Update settings for a product in a branch
   */
  async updateSettings(
    productId: string,
    branchId: string,
    updates: UpdateProductBranchSettingsData
  ): Promise<ProductBranchSettings | null> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("product_branch_settings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("Error updating product branch settings:", error);
      throw error;
    }

    return data;
  },

  /**
   * Soft delete settings for a product in a branch
   */
  async deleteSettings(productId: string, branchId: string): Promise<boolean> {
    const supabase = createClient();

    const { error } = await supabase
      .from("product_branch_settings")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .is("deleted_at", null);

    if (error) {
      console.error("Error deleting product branch settings:", error);
      return false;
    }

    return true;
  },

  /**
   * Initialize settings for a product across all branches in an organization
   * Useful when creating a new product
   */
  async initializeForAllBranches(
    productId: string,
    organizationId: string,
    defaultSettings?: Partial<CreateProductBranchSettingsData>
  ): Promise<ProductBranchSettings[]> {
    const supabase = createClient();

    // Get all active branches for the organization
    const { data: branches, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (branchError || !branches || branches.length === 0) {
      console.error("Error fetching branches:", branchError);
      return [];
    }

    // Create settings for each branch
    const settingsToCreate = branches.map((branch) => ({
      product_id: productId,
      branch_id: branch.id,
      organization_id: organizationId,
      ...defaultSettings,
    }));

    const { data, error } = await supabase
      .from("product_branch_settings")
      .upsert(settingsToCreate, {
        onConflict: "product_id,branch_id",
      })
      .select();

    if (error) {
      console.error("Error initializing product branch settings:", error);
      throw error;
    }

    return data || [];
  },
};
