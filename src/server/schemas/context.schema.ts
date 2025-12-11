import { z } from "zod";

// ==========================================
// ENUMS
// ==========================================

export const contextTypeSchema = z.enum(["system", "custom"]);

export const accessLevelSchema = z.enum(["public", "token_required", "private"]);

export const visibilityLevelSchema = z.enum(["always", "on_request", "never"]);

// ==========================================
// INPUT SCHEMAS
// ==========================================

/**
 * Schema for creating a custom context
 */
export const createCustomContextSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  display_name: z.string().min(1).max(200),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  is_active: z.boolean().optional().default(true),
  requires_subscription: z.boolean().optional().default(false),
  subscription_tier: z.string().optional(),
  api_enabled: z.boolean().optional().default(false),
  api_rate_limit: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Schema for updating a context configuration
 */
export const updateContextConfigurationSchema = z.object({
  display_name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  is_active: z.boolean().optional(),
  requires_subscription: z.boolean().optional(),
  subscription_tier: z.string().optional(),
  api_enabled: z.boolean().optional(),
  api_rate_limit: z.number().int().positive().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Schema for setting field visibility rules
 */
export const setFieldVisibilitySchema = z.object({
  context_id: z.string().uuid(),
  field_name: z.string().min(1).max(100),
  visibility_level: visibilityLevelSchema,
  access_level: accessLevelSchema.optional(),
  requires_permission: z.string().optional(),
  custom_rules: z.record(z.any()).optional(),
});

/**
 * Schema for cloning a system context
 */
export const cloneSystemContextSchema = z.object({
  source_context_id: z.string().uuid(),
  organization_id: z.string().uuid(),
  new_name: z.string().min(1).max(100),
  new_display_name: z.string().min(1).max(200),
  customizations: z
    .object({
      description: z.string().optional(),
      icon: z.string().optional(),
      color: z
        .string()
        .regex(/^#[0-9A-Fa-f]{6}$/)
        .optional(),
      is_active: z.boolean().optional(),
      api_enabled: z.boolean().optional(),
      metadata: z.record(z.any()).optional(),
    })
    .optional(),
  clone_field_visibility: z.boolean().optional().default(true),
});

/**
 * Schema for filtering contexts
 */
export const contextFiltersSchema = z.object({
  type: contextTypeSchema.optional(),
  is_active: z.boolean().optional(),
  api_enabled: z.boolean().optional(),
  requires_subscription: z.boolean().optional(),
  search: z.string().optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type ContextType = z.infer<typeof contextTypeSchema>;
export type AccessLevel = z.infer<typeof accessLevelSchema>;
export type VisibilityLevel = z.infer<typeof visibilityLevelSchema>;

export type CreateCustomContextInput = z.infer<typeof createCustomContextSchema>;
export type UpdateContextConfigurationInput = z.infer<typeof updateContextConfigurationSchema>;
export type SetFieldVisibilityInput = z.infer<typeof setFieldVisibilitySchema>;
export type CloneSystemContextInput = z.infer<typeof cloneSystemContextSchema>;
export type ContextFilters = z.infer<typeof contextFiltersSchema>;
