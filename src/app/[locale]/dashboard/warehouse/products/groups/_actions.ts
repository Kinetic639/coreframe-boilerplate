"use server";

import { ProductGroupsService } from "@/server/services/product-groups.service";
import {
  createProductGroupSchema,
  updateVariantSchema,
  bulkUpdateVariantsSchema,
  stockAdjustmentSchema,
  type CreateProductGroupInput,
  type UpdateVariantInput,
  type BulkUpdateVariantsInput,
  type StockAdjustmentInput,
} from "@/server/schemas/product-groups.schema";
import { getUserContext } from "@/lib/utils/assert-auth";

// ==========================================
// PRODUCT GROUPS SERVER ACTIONS
// ==========================================

/**
 * Create a new product group with all variants
 */
export async function createProductGroupAction(input: CreateProductGroupInput) {
  try {
    const { user } = await getUserContext();

    // Validate input
    const validatedData = createProductGroupSchema.parse(input);

    // Get organization ID from user context
    const organizationId = user.user_metadata?.active_org_id;
    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID not found in user context",
      };
    }

    const productGroup = await ProductGroupsService.createProductGroup(
      validatedData,
      organizationId,
      user.id
    );

    return {
      success: true,
      data: productGroup,
    };
  } catch (error) {
    console.error("Error creating product group:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create product group",
    };
  }
}

/**
 * Get product group by ID with all variants and details
 */
export async function getProductGroupByIdAction(productId: string) {
  try {
    await getUserContext();

    const productGroup = await ProductGroupsService.getProductGroupById(productId);

    if (!productGroup) {
      return {
        success: false,
        error: "Product group not found",
      };
    }

    return {
      success: true,
      data: productGroup,
    };
  } catch (error) {
    console.error("Error fetching product group:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product group",
    };
  }
}

/**
 * Update a specific variant
 */
export async function updateVariantAction(variantId: string, input: UpdateVariantInput) {
  try {
    await getUserContext();

    // Validate input
    const validatedData = updateVariantSchema.parse(input);

    const variant = await ProductGroupsService.updateVariant(variantId, validatedData);

    return {
      success: true,
      data: variant,
    };
  } catch (error) {
    console.error("Error updating variant:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update variant",
    };
  }
}

/**
 * Soft delete a variant
 */
export async function deleteVariantAction(variantId: string) {
  try {
    await getUserContext();

    await ProductGroupsService.deleteVariant(variantId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting variant:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete variant",
    };
  }
}

/**
 * Soft delete a product group (and all its variants)
 */
export async function deleteProductGroupAction(productId: string) {
  try {
    await getUserContext();

    await ProductGroupsService.deleteProductGroup(productId);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting product group:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete product group",
    };
  }
}

/**
 * Adjust stock for a specific variant
 * @deprecated This should use stock movements service
 */
export async function adjustVariantStockAction(input: StockAdjustmentInput) {
  try {
    await getUserContext();

    // Validate input
    const validatedData = stockAdjustmentSchema.parse(input);

    await ProductGroupsService.adjustVariantStock(validatedData);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error adjusting variant stock:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to adjust variant stock",
    };
  }
}

/**
 * Bulk update variants
 */
export async function bulkUpdateVariantsAction(input: BulkUpdateVariantsInput) {
  try {
    await getUserContext();

    // Validate input
    const validatedData = bulkUpdateVariantsSchema.parse(input);

    await ProductGroupsService.bulkUpdateVariants(validatedData);

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error bulk updating variants:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to bulk update variants",
    };
  }
}

/**
 * Get all variants for a product group
 */
export async function getVariantsByProductIdAction(productId: string) {
  try {
    await getUserContext();

    const variants = await ProductGroupsService.getVariantsByProductId(productId);

    return {
      success: true,
      data: variants,
    };
  } catch (error) {
    console.error("Error fetching variants:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch variants",
    };
  }
}
