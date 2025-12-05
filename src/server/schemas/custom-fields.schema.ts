import { z } from "zod";

// ==========================================
// CUSTOM FIELDS SCHEMAS
// ==========================================

/**
 * Field type enum
 */
export const fieldTypeSchema = z.enum(["text", "number", "boolean", "date", "dropdown"]);

/**
 * Schema for creating a custom field definition
 */
export const createFieldDefinitionSchema = z.object({
  organization_id: z.string().uuid(),
  field_name: z.string().min(1).max(100),
  field_type: fieldTypeSchema,
  dropdown_options: z.array(z.string()).optional().nullable(),
  display_order: z.number().int().nonnegative().optional(),
});

/**
 * Schema for updating a custom field definition
 */
export const updateFieldDefinitionSchema = z.object({
  field_name: z.string().min(1).max(100).optional(),
  field_type: fieldTypeSchema.optional(),
  dropdown_options: z.array(z.string()).optional().nullable(),
  display_order: z.number().int().nonnegative().optional(),
});

/**
 * Schema for reordering field definitions
 */
export const reorderFieldDefinitionsSchema = z.array(
  z.object({
    id: z.string().uuid(),
    display_order: z.number().int().nonnegative(),
  })
);

/**
 * Schema for creating a custom field value
 */
export const createFieldValueSchema = z.object({
  field_definition_id: z.string().uuid(),
  product_id: z.string().uuid().optional().nullable(),
  variant_id: z.string().uuid().optional().nullable(),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type FieldType = z.infer<typeof fieldTypeSchema>;
export type CreateFieldDefinitionInput = z.infer<typeof createFieldDefinitionSchema>;
export type UpdateFieldDefinitionInput = z.infer<typeof updateFieldDefinitionSchema>;
export type ReorderFieldDefinitionsInput = z.infer<typeof reorderFieldDefinitionsSchema>;
export type CreateFieldValueInput = z.infer<typeof createFieldValueSchema>;
