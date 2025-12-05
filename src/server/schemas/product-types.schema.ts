import { z } from "zod";

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating a product type
 */
export const createProductTypeSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/),
  icon: z.string().optional(),
});

/**
 * Schema for updating a product type
 */
export const updateProductTypeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  icon: z.string().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateProductTypeInput = z.infer<typeof createProductTypeSchema>;
export type UpdateProductTypeInput = z.infer<typeof updateProductTypeSchema>;
