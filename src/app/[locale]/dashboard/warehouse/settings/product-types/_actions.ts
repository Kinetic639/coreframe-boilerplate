"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { ProductTypesService } from "@/server/services/product-types.service";
import {
  createProductTypeSchema,
  updateProductTypeSchema,
  type CreateProductTypeInput,
  type UpdateProductTypeInput,
} from "@/server/schemas/product-types.schema";

// ==========================================
// PRODUCT TYPES SERVER ACTIONS
// ==========================================

/**
 * Get all product types for the organization
 */
export async function getProductTypesAction() {
  try {
    const { supabase, organizationId } = await getUserContext();

    const productTypes = await ProductTypesService.getProductTypes(supabase, organizationId);

    return { success: true, data: productTypes };
  } catch (error) {
    console.error("[getProductTypesAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product types",
    };
  }
}

/**
 * Get a single product type by ID
 */
export async function getProductTypeAction(productTypeId: string) {
  try {
    const { supabase } = await getUserContext();

    const productType = await ProductTypesService.getProductType(supabase, productTypeId);

    if (!productType) {
      return { success: false, error: "Product type not found" };
    }

    return { success: true, data: productType };
  } catch (error) {
    console.error("[getProductTypeAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product type",
    };
  }
}

/**
 * Get a product type by slug
 */
export async function getProductTypeBySlugAction(slug: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    const productType = await ProductTypesService.getProductTypeBySlug(
      supabase,
      slug,
      organizationId
    );

    if (!productType) {
      return { success: false, error: "Product type not found" };
    }

    return { success: true, data: productType };
  } catch (error) {
    console.error("[getProductTypeBySlugAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch product type",
    };
  }
}

/**
 * Create a new product type
 */
export async function createProductTypeAction(
  input: Omit<CreateProductTypeInput, "organization_id">
) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = createProductTypeSchema.parse({
      ...input,
      organization_id: organizationId,
    });

    const productType = await ProductTypesService.createProductType(supabase, validatedInput);

    return { success: true, data: productType };
  } catch (error) {
    console.error("[createProductTypeAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create product type",
    };
  }
}

/**
 * Update a product type
 */
export async function updateProductTypeAction(
  productTypeId: string,
  input: UpdateProductTypeInput
) {
  try {
    const { supabase } = await getUserContext();

    // Validate input
    const validatedInput = updateProductTypeSchema.parse(input);

    const productType = await ProductTypesService.updateProductType(
      supabase,
      productTypeId,
      validatedInput
    );

    return { success: true, data: productType };
  } catch (error) {
    console.error("[updateProductTypeAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update product type",
    };
  }
}

/**
 * Delete a product type
 */
export async function deleteProductTypeAction(productTypeId: string) {
  try {
    const { supabase } = await getUserContext();

    await ProductTypesService.deleteProductType(supabase, productTypeId);

    return { success: true };
  } catch (error) {
    console.error("[deleteProductTypeAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete product type",
    };
  }
}
