"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import {
  productFiltersSchema,
  createProductSchema,
  updateProductSchema,
  createBarcodeSchema,
} from "@/server/schemas/products.schema";
import { ProductsService } from "@/server/services/products.service";

/**
 * Get paginated products with optional filtering.
 * No middleware - direct auth check.
 */
export async function getProducts(filters: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedFilters = productFiltersSchema.parse(filters);

    return await ProductsService.getProducts(ctx.supabase, ctx.organizationId, validatedFilters);
  } catch (error) {
    console.error("getProducts error:", error);
    throw error;
  }
}

/**
 * Get a single product by ID
 */
export async function getProductById(productId: string) {
  try {
    const ctx = await getUserContext();
    return await ProductsService.getProductById(ctx.supabase, productId);
  } catch (error) {
    console.error("getProductById error:", error);
    throw error;
  }
}

/**
 * Create a new product
 */
export async function createProduct(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = createProductSchema.parse(input);

    return await ProductsService.createProduct(
      ctx.supabase,
      ctx.organizationId,
      ctx.user.id,
      validatedInput
    );
  } catch (error) {
    console.error("createProduct error:", error);
    throw error;
  }
}

/**
 * Update an existing product
 */
export async function updateProduct(productId: string, input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = updateProductSchema.parse(input);

    return await ProductsService.updateProduct(ctx.supabase, productId, validatedInput);
  } catch (error) {
    console.error("updateProduct error:", error);
    throw error;
  }
}

/**
 * Soft delete a product
 */
export async function deleteProduct(productId: string) {
  try {
    const ctx = await getUserContext();
    await ProductsService.deleteProduct(ctx.supabase, productId);
    return { success: true };
  } catch (error) {
    console.error("deleteProduct error:", error);
    throw error;
  }
}

/**
 * Permanently delete a product
 */
export async function permanentlyDeleteProduct(productId: string) {
  try {
    const ctx = await getUserContext();
    await ProductsService.permanentlyDeleteProduct(ctx.supabase, productId);
    return { success: true };
  } catch (error) {
    console.error("permanentlyDeleteProduct error:", error);
    throw error;
  }
}

/**
 * Add a barcode to a product
 */
export async function addBarcode(input: unknown) {
  try {
    const ctx = await getUserContext();
    const validatedInput = createBarcodeSchema.parse(input);

    return await ProductsService.addBarcode(
      ctx.supabase,
      validatedInput.product_id,
      validatedInput.variant_id,
      validatedInput.barcode,
      validatedInput.is_primary
    );
  } catch (error) {
    console.error("addBarcode error:", error);
    throw error;
  }
}

/**
 * Remove a barcode
 */
export async function removeBarcode(barcodeId: string) {
  try {
    const ctx = await getUserContext();
    await ProductsService.removeBarcode(ctx.supabase, barcodeId);
    return { success: true };
  } catch (error) {
    console.error("removeBarcode error:", error);
    throw error;
  }
}

/**
 * Set a barcode as primary
 */
export async function setPrimaryBarcode(barcodeId: string, productId: string) {
  try {
    const ctx = await getUserContext();
    await ProductsService.setPrimaryBarcode(ctx.supabase, barcodeId, productId);
    return { success: true };
  } catch (error) {
    console.error("setPrimaryBarcode error:", error);
    throw error;
  }
}

/**
 * Get all barcodes for a product
 */
export async function getProductBarcodes(productId: string) {
  try {
    const ctx = await getUserContext();
    return await ProductsService.getProductBarcodes(ctx.supabase, productId);
  } catch (error) {
    console.error("getProductBarcodes error:", error);
    throw error;
  }
}
