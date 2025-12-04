/**
 * Product Branch Settings Service
 * Handles per-warehouse product configuration (inventory thresholds, alerts, lead times)
 */

import { SupabaseClient } from "@supabase/supabase-js";
import { Database } from "../../../supabase/types/types";
import type {
  CreateProductBranchSettingsInput,
  UpdateProductBranchSettingsInput,
  InitializeForAllBranchesInput,
} from "@/server/schemas/product-branch-settings.schema";

// =====================================================
// TYPES
// =====================================================

export type ProductBranchSettingsRow =
  Database["public"]["Tables"]["product_branch_settings"]["Row"];

export interface ProductWithBranchSettings {
  product_id: string;
  product_name: string;
  product_sku: string | null;
  branch_id: string;
  branch_name: string;
  settings: ProductBranchSettingsRow | null;
}

// =====================================================
// SERVICE
// =====================================================

export class ProductBranchSettingsService {
  /**
   * Get settings for a product in a specific branch
   */
  static async getSettings(
    supabase: SupabaseClient<Database>,
    productId: string,
    branchId: string,
    organizationId: string
  ): Promise<ProductBranchSettingsRow | null> {
    const { data, error } = await supabase
      .from("product_branch_settings")
      .select("*")
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No rows found
        return null;
      }
      console.error("[ProductBranchSettingsService.getSettings] Error:", error);
      throw new Error(`Failed to fetch product branch settings: ${error.message}`);
    }

    return data;
  }

  /**
   * Get all branch settings for a product (all warehouses)
   */
  static async getSettingsForProduct(
    supabase: SupabaseClient<Database>,
    productId: string,
    organizationId: string
  ): Promise<ProductBranchSettingsRow[]> {
    const { data, error } = await supabase
      .from("product_branch_settings")
      .select("*")
      .eq("product_id", productId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[ProductBranchSettingsService.getSettingsForProduct] Error:", error);
      throw new Error(`Failed to fetch product branch settings: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get all products with settings for a specific branch
   */
  static async getProductsForBranch(
    supabase: SupabaseClient<Database>,
    branchId: string,
    organizationId: string
  ): Promise<ProductWithBranchSettings[]> {
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
      console.error("[ProductBranchSettingsService.getProductsForBranch] Error:", error);
      throw new Error(`Failed to fetch products for branch: ${error.message}`);
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
  }

  /**
   * Create or update settings for a product in a branch
   */
  static async upsertSettings(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    input: CreateProductBranchSettingsInput
  ): Promise<ProductBranchSettingsRow> {
    // Ensure organization_id matches
    if (input.organization_id !== organizationId) {
      throw new Error("Organization ID mismatch");
    }

    const { data, error } = await supabase
      .from("product_branch_settings")
      .upsert(input as any, {
        onConflict: "product_id,branch_id",
      })
      .select()
      .single();

    if (error) {
      console.error("[ProductBranchSettingsService.upsertSettings] Error:", error);
      throw new Error(`Failed to upsert product branch settings: ${error.message}`);
    }

    return data;
  }

  /**
   * Update settings for a product in a branch
   */
  static async updateSettings(
    supabase: SupabaseClient<Database>,
    productId: string,
    branchId: string,
    organizationId: string,
    updates: UpdateProductBranchSettingsInput
  ): Promise<ProductBranchSettingsRow> {
    const { data, error } = await supabase
      .from("product_branch_settings")
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) {
      console.error("[ProductBranchSettingsService.updateSettings] Error:", error);
      throw new Error(`Failed to update product branch settings: ${error.message}`);
    }

    return data;
  }

  /**
   * Soft delete settings for a product in a branch
   */
  static async deleteSettings(
    supabase: SupabaseClient<Database>,
    productId: string,
    branchId: string,
    organizationId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("product_branch_settings")
      .update({
        deleted_at: new Date().toISOString(),
      })
      .eq("product_id", productId)
      .eq("branch_id", branchId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null);

    if (error) {
      console.error("[ProductBranchSettingsService.deleteSettings] Error:", error);
      throw new Error(`Failed to delete product branch settings: ${error.message}`);
    }
  }

  /**
   * Initialize settings for a product across all branches in an organization
   * Useful when creating a new product
   */
  static async initializeForAllBranches(
    supabase: SupabaseClient<Database>,
    input: InitializeForAllBranchesInput
  ): Promise<ProductBranchSettingsRow[]> {
    const { product_id, organization_id, default_settings } = input;

    // Get all active branches for the organization
    const { data: branches, error: branchError } = await supabase
      .from("branches")
      .select("id")
      .eq("organization_id", organization_id)
      .is("deleted_at", null);

    if (branchError) {
      console.error(
        "[ProductBranchSettingsService.initializeForAllBranches] Error fetching branches:",
        branchError
      );
      throw new Error(`Failed to fetch branches: ${branchError.message}`);
    }

    if (!branches || branches.length === 0) {
      console.warn(
        "[ProductBranchSettingsService.initializeForAllBranches] No branches found for organization"
      );
      return [];
    }

    // Create settings for each branch
    const settingsToCreate = branches.map((branch) => ({
      product_id,
      branch_id: branch.id,
      organization_id,
      ...default_settings,
    }));

    const { data, error } = await supabase
      .from("product_branch_settings")
      .upsert(settingsToCreate, {
        onConflict: "product_id,branch_id",
      })
      .select();

    if (error) {
      console.error("[ProductBranchSettingsService.initializeForAllBranches] Error:", error);
      throw new Error(`Failed to initialize product branch settings: ${error.message}`);
    }

    return data || [];
  }
}
