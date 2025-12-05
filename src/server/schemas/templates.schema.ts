import { z } from "zod";

// ==========================================
// TEMPLATES SCHEMAS
// ==========================================

/**
 * Data type enum for template attributes
 */
export const dataTypeSchema = z.enum(["text", "number", "boolean", "date", "dropdown", "json"]);

/**
 * Context scope enum
 */
export const contextScopeSchema = z.enum(["warehouse", "sales", "purchasing", "production"]);

/**
 * Template category enum
 */
export const templateCategorySchema = z.enum(["general", "custom", "industry", "integration"]);

/**
 * Schema for template attribute
 */
export const templateAttributeSchema = z.object({
  slug: z.string().optional(),
  label: z.union([
    z.string(),
    z.object({
      en: z.string().optional(),
      pl: z.string().optional(),
    }),
  ]),
  description: z
    .union([
      z.string(),
      z.object({
        en: z.string().optional(),
        pl: z.string().optional(),
      }),
    ])
    .optional(),
  data_type: dataTypeSchema.optional(),
  is_required: z.boolean().optional(),
  is_unique: z.boolean().optional(),
  is_searchable: z.boolean().optional(),
  default_value: z.any().optional().nullable(),
  validation_rules: z.record(z.any()).optional(),
  context_scope: contextScopeSchema.optional(),
  display_order: z.number().int().nonnegative().optional(),
});

/**
 * Schema for creating a template
 */
export const createTemplateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  slug: z.string().max(100).optional(),
  organization_id: z.string().uuid().optional().nullable(),
  parent_template_id: z.string().uuid().optional().nullable(),
  category: templateCategorySchema.optional(),
  icon: z.string().max(50).optional().nullable(),
  color: z.string().max(20).optional().nullable(),
  supported_contexts: z.array(contextScopeSchema).optional(),
  settings: z.record(z.any()).optional(),
  attributes: z.array(templateAttributeSchema).optional(),
  created_by: z.string().uuid().optional().nullable(),
});

/**
 * Schema for updating a template
 */
export const updateTemplateSchema = createTemplateSchema.partial();

/**
 * Schema for cloning a template
 */
export const cloneTemplateSchema = z.object({
  source_template_id: z.string().uuid(),
  target_organization_id: z.string().uuid(),
  new_name: z.string().min(1).max(200).optional(),
  customizations: z
    .object({
      description: z.string().max(1000).optional().nullable(),
      category: templateCategorySchema.optional(),
      icon: z.string().max(50).optional().nullable(),
      color: z.string().max(20).optional().nullable(),
      supported_contexts: z.array(contextScopeSchema).optional(),
      settings: z.record(z.any()).optional(),
    })
    .optional(),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type DataType = z.infer<typeof dataTypeSchema>;
export type ContextScope = z.infer<typeof contextScopeSchema>;
export type TemplateCategory = z.infer<typeof templateCategorySchema>;
export type TemplateAttribute = z.infer<typeof templateAttributeSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CloneTemplateInput = z.infer<typeof cloneTemplateSchema>;
