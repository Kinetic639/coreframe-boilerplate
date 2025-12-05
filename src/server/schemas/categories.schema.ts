/**
 * Categories Schema
 * Input validation for product category operations
 */

import { z } from "zod";

/**
 * Create category data
 */
export const createCategorySchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional().nullable(),
  parent_id: z.string().uuid().optional().nullable(),
  icon_name: z.string().max(100).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
});

/**
 * Update category data
 */
export const updateCategorySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  icon_name: z.string().max(100).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .nullable(),
});

/**
 * Reorder category item
 */
export const reorderCategoryItemSchema = z.object({
  id: z.string().uuid(),
  sort_order: z.number().int().nonnegative(),
});

/**
 * Reorder categories input
 */
export const reorderCategoriesSchema = z.object({
  organization_id: z.string().uuid(),
  parent_id: z.string().uuid().nullable(),
  items: z.array(reorderCategoryItemSchema),
});

/**
 * Move category input
 */
export const moveCategorySchema = z.object({
  category_id: z.string().uuid(),
  new_parent_id: z.string().uuid().nullable(),
});

/**
 * Type exports
 */
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ReorderCategoryItem = z.infer<typeof reorderCategoryItemSchema>;
export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
export type MoveCategoryInput = z.infer<typeof moveCategorySchema>;
