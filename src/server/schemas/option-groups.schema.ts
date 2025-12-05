import { z } from "zod";

// ==========================================
// OPTION GROUPS SCHEMAS
// ==========================================

/**
 * Schema for creating an option group
 */
export const createOptionGroupSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  values: z
    .array(
      z.object({
        value: z.string().min(1).max(100),
        display_order: z.number().int().nonnegative().optional(),
      })
    )
    .optional(),
});

/**
 * Schema for updating an option group
 */
export const updateOptionGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
});

/**
 * Schema for creating an option value
 */
export const createOptionValueSchema = z.object({
  option_group_id: z.string().uuid(),
  value: z.string().min(1).max(100),
  display_order: z.number().int().nonnegative().optional(),
});

/**
 * Schema for updating an option value
 */
export const updateOptionValueSchema = z.object({
  id: z.string().uuid(),
  value: z.string().min(1).max(100).optional(),
  display_order: z.number().int().nonnegative().optional(),
});

/**
 * Schema for option group filters
 */
export const optionGroupFiltersSchema = z.object({
  organizationId: z.string().uuid(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type CreateOptionGroupInput = z.infer<typeof createOptionGroupSchema>;
export type UpdateOptionGroupInput = z.infer<typeof updateOptionGroupSchema>;
export type CreateOptionValueInput = z.infer<typeof createOptionValueSchema>;
export type UpdateOptionValueInput = z.infer<typeof updateOptionValueSchema>;
export type OptionGroupFilters = z.infer<typeof optionGroupFiltersSchema>;
