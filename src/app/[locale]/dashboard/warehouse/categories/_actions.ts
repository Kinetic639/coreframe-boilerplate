/**
 * Categories Server Actions
 * Co-located with the categories route
 */

"use server";

import { getUserContext } from "@/lib/utils/assert-auth";
import { CategoriesService } from "@/server/services/categories.service";
import {
  createCategorySchema,
  updateCategorySchema,
  reorderCategoriesSchema,
  moveCategorySchema,
} from "@/server/schemas/categories.schema";

/**
 * Get all categories as tree
 */
export async function getCategories() {
  const ctx = await getUserContext();
  return await CategoriesService.getCategories(ctx.supabase, ctx.organizationId);
}

/**
 * Get single category by ID
 */
export async function getCategoryById(categoryId: string) {
  const ctx = await getUserContext();
  return await CategoriesService.getCategoryById(ctx.supabase, categoryId);
}

/**
 * Get default category
 */
export async function getDefaultCategory() {
  const ctx = await getUserContext();
  return await CategoriesService.getDefaultCategory(ctx.supabase, ctx.organizationId);
}

/**
 * Get first non-default category
 */
export async function getFirstCategory() {
  const ctx = await getUserContext();
  return await CategoriesService.getFirstCategory(ctx.supabase, ctx.organizationId);
}

/**
 * Create new category
 */
export async function createCategory(input: unknown) {
  const ctx = await getUserContext();
  const validated = createCategorySchema.parse(input);
  return await CategoriesService.createCategory(ctx.supabase, validated);
}

/**
 * Update category
 */
export async function updateCategory(categoryId: string, input: unknown) {
  const ctx = await getUserContext();
  const validated = updateCategorySchema.parse(input);
  return await CategoriesService.updateCategory(ctx.supabase, categoryId, validated);
}

/**
 * Check deletion requirements
 */
export async function checkDeletion(categoryId: string) {
  const ctx = await getUserContext();
  return await CategoriesService.checkDeletion(ctx.supabase, categoryId);
}

/**
 * Delete category (with product reassignment)
 */
export async function deleteCategory(categoryId: string) {
  const ctx = await getUserContext();
  return await CategoriesService.deleteCategory(ctx.supabase, categoryId);
}

/**
 * Reorder categories at same level
 */
export async function reorderCategories(input: unknown) {
  const ctx = await getUserContext();
  const validated = reorderCategoriesSchema.parse(input);
  return await CategoriesService.reorderCategories(
    ctx.supabase,
    validated.organization_id,
    validated.parent_id,
    validated.items
  );
}

/**
 * Move category to different parent
 */
export async function moveCategory(input: unknown) {
  const ctx = await getUserContext();
  const validated = moveCategorySchema.parse(input);
  return await CategoriesService.moveCategory(
    ctx.supabase,
    validated.category_id,
    validated.new_parent_id
  );
}

/**
 * Toggle preferred status
 */
export async function togglePreferred(categoryId: string) {
  const ctx = await getUserContext();
  return await CategoriesService.togglePreferred(ctx.supabase, categoryId);
}

/**
 * Get preferred categories
 */
export async function getPreferredCategories() {
  const ctx = await getUserContext();
  return await CategoriesService.getPreferredCategories(ctx.supabase, ctx.organizationId);
}

/**
 * Count products in category
 */
export async function countProducts(categoryId: string) {
  const ctx = await getUserContext();
  return await CategoriesService.countProducts(ctx.supabase, categoryId);
}

/**
 * Count child categories
 */
export async function countChildren(categoryId: string) {
  const ctx = await getUserContext();
  return await CategoriesService.countChildren(ctx.supabase, categoryId);
}
