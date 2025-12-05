/**
 * Product Branch Settings Server Actions
 * Next.js server actions for per-warehouse product configuration
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { ProductBranchSettingsService } from "@/server/services/product-branch-settings.service";
import {
  createProductBranchSettingsSchema,
  updateProductBranchSettingsSchema,
  initializeForAllBranchesSchema,
  type CreateProductBranchSettingsInput,
  type UpdateProductBranchSettingsInput,
  type InitializeForAllBranchesInput,
} from "@/server/schemas/product-branch-settings.schema";

// =====================================================
// QUERY ACTIONS
// =====================================================

/**
 * Get settings for a product in a specific branch
 */
export async function getProductBranchSettingsAction(productId: string, branchId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    const settings = await ProductBranchSettingsService.getSettings(
      supabase,
      productId,
      branchId,
      organizationId
    );

    return { success: true, data: settings };
  } catch (error) {
    console.error("[getProductBranchSettingsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product branch settings",
    };
  }
}

/**
 * Get all branch settings for a product (all warehouses)
 */
export async function getSettingsForProductAction(productId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    const settings = await ProductBranchSettingsService.getSettingsForProduct(
      supabase,
      productId,
      organizationId
    );

    return { success: true, data: settings };
  } catch (error) {
    console.error("[getSettingsForProductAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product settings",
    };
  }
}

/**
 * Get all products with settings for a specific branch
 */
export async function getProductsForBranchAction(branchId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    const products = await ProductBranchSettingsService.getProductsForBranch(
      supabase,
      branchId,
      organizationId
    );

    return { success: true, data: products };
  } catch (error) {
    console.error("[getProductsForBranchAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch products for branch",
    };
  }
}

// =====================================================
// MUTATION ACTIONS
// =====================================================

/**
 * Create or update settings for a product in a branch
 */
export async function upsertProductBranchSettingsAction(input: CreateProductBranchSettingsInput) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    // Validate input
    const validatedInput = createProductBranchSettingsSchema.parse(input);

    const settings = await ProductBranchSettingsService.upsertSettings(
      supabase,
      organizationId,
      validatedInput
    );

    return { success: true, data: settings };
  } catch (error) {
    console.error("[upsertProductBranchSettingsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save product branch settings",
    };
  }
}

/**
 * Update settings for a product in a branch
 */
export async function updateProductBranchSettingsAction(
  productId: string,
  branchId: string,
  updates: UpdateProductBranchSettingsInput
) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    // Validate input
    const validatedUpdates = updateProductBranchSettingsSchema.parse(updates);

    const settings = await ProductBranchSettingsService.updateSettings(
      supabase,
      productId,
      branchId,
      organizationId,
      validatedUpdates
    );

    return { success: true, data: settings };
  } catch (error) {
    console.error("[updateProductBranchSettingsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update product branch settings",
    };
  }
}

/**
 * Delete settings for a product in a branch
 */
export async function deleteProductBranchSettingsAction(productId: string, branchId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    await ProductBranchSettingsService.deleteSettings(
      supabase,
      productId,
      branchId,
      organizationId
    );

    return { success: true, data: { productId, branchId } };
  } catch (error) {
    console.error("[deleteProductBranchSettingsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete product branch settings",
    };
  }
}

/**
 * Initialize settings for a product across all branches
 */
export async function initializeForAllBranchesAction(input: InitializeForAllBranchesInput) {
  try {
    const { supabase, organizationId } = await getUserContext();

    if (!organizationId) {
      return { success: false, error: "No active organization found" };
    }

    // Validate input
    const validatedInput = initializeForAllBranchesSchema.parse(input);

    const settings = await ProductBranchSettingsService.initializeForAllBranches(
      supabase,
      validatedInput
    );

    return { success: true, data: settings };
  } catch (error) {
    console.error("[initializeForAllBranchesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to initialize product settings",
    };
  }
}
