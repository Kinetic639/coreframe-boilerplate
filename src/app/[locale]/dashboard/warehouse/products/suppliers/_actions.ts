/**
 * Product-Suppliers Server Actions
 * Co-located with the product suppliers route
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { ProductSuppliersService } from "@/server/services/product-suppliers.service";
import {
  addSupplierSchema,
  updateSupplierSchema,
  updatePriceSchema,
  setPreferredSupplierSchema,
  getBestPriceSupplierSchema,
} from "@/server/schemas/product-suppliers.schema";

/**
 * Get all suppliers for a product
 */
export async function getProductSuppliers(productId: string, activeOnly: boolean = true) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.getProductSuppliers(ctx.supabase, productId, activeOnly);
}

/**
 * Get preferred supplier for a product
 */
export async function getPreferredSupplier(productId: string) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.getPreferredSupplier(ctx.supabase, productId);
}

/**
 * Get best price supplier considering MOQ and order multiples
 */
export async function getBestPriceSupplier(input: unknown) {
  const ctx = await getUserContext();
  const validated = getBestPriceSupplierSchema.parse(input);
  return await ProductSuppliersService.getBestPriceSupplier(
    ctx.supabase,
    validated.product_id,
    validated.quantity
  );
}

/**
 * Get all products for a supplier
 */
export async function getSupplierProducts(supplierId: string, activeOnly: boolean = true) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.getSupplierProducts(ctx.supabase, supplierId, activeOnly);
}

/**
 * Add a new supplier to a product
 */
export async function addSupplier(input: unknown) {
  const ctx = await getUserContext();
  const validated = addSupplierSchema.parse(input);
  return await ProductSuppliersService.addSupplier(
    ctx.supabase,
    validated.product_id,
    validated.data,
    ctx.user.id
  );
}

/**
 * Update product-supplier relationship
 */
export async function updateSupplier(input: unknown) {
  const ctx = await getUserContext();
  const validated = updateSupplierSchema.parse(input);
  return await ProductSuppliersService.updateSupplier(ctx.supabase, validated.id, validated.data);
}

/**
 * Remove supplier from product (soft delete)
 */
export async function removeSupplier(id: string) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.removeSupplier(ctx.supabase, id);
}

/**
 * Set a supplier as preferred
 */
export async function setPreferredSupplier(input: unknown) {
  const ctx = await getUserContext();
  const validated = setPreferredSupplierSchema.parse(input);
  return await ProductSuppliersService.setPreferredSupplier(
    ctx.supabase,
    validated.product_id,
    validated.supplier_id
  );
}

/**
 * Update supplier price
 */
export async function updatePrice(input: unknown) {
  const ctx = await getUserContext();
  const validated = updatePriceSchema.parse(input);
  return await ProductSuppliersService.updatePrice(
    ctx.supabase,
    validated.id,
    validated.new_price,
    validated.reason
  );
}

/**
 * Get price history for a product-supplier relationship
 */
export async function getPriceHistory(productSupplierId: string) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.getPriceHistory(ctx.supabase, productSupplierId);
}

/**
 * Check if product has any suppliers
 */
export async function hasSuppliers(productId: string) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.hasSuppliers(ctx.supabase, productId);
}

/**
 * Get supplier count for a product
 */
export async function getSupplierCount(productId: string) {
  const ctx = await getUserContext();
  return await ProductSuppliersService.getSupplierCount(ctx.supabase, productId);
}
