import { z } from "zod";

// ==========================================
// VARIANT GENERATION SCHEMAS
// ==========================================

/**
 * Schema for selected attribute used in variant generation
 */
export const selectedAttributeSchema = z.object({
  optionGroup: z.object({
    id: z.string().uuid(),
    name: z.string(),
    values: z.array(
      z.object({
        id: z.string().uuid(),
        value: z.string(),
      })
    ),
  }),
  selectedValueIds: z.array(z.string().uuid()),
});

/**
 * Schema for generated variant
 */
export const generatedVariantSchema = z.object({
  name: z.string(),
  sku: z.string(),
  attributeValues: z.array(
    z.object({
      optionGroupId: z.string().uuid(),
      optionGroupName: z.string(),
      optionValueId: z.string().uuid(),
      optionValueName: z.string(),
    })
  ),
  sellingPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative(),
  reorderPoint: z.number().nonnegative(),
  isActive: z.boolean(),
});

/**
 * Schema for SKU generator configuration
 */
export const skuGeneratorConfigSchema = z.object({
  includeBaseName: z.boolean(),
  baseNameFormat: z.enum(["first", "last", "full"]),
  baseNameCase: z.enum(["upper", "lower", "title"]),
  separator: z.string().max(5),
  includeAttributes: z.array(
    z.object({
      attributeName: z.string(),
      include: z.boolean(),
      displayFormat: z.enum(["first", "last", "full"]),
      letterCase: z.enum(["upper", "lower", "title"]),
    })
  ),
});

/**
 * Schema for variant combination generation input
 */
export const generateVariantCombinationsSchema = z.object({
  baseName: z.string().min(1).max(200),
  selectedAttributes: z.array(selectedAttributeSchema),
  defaultPrices: z.object({
    selling: z.number().nonnegative(),
    cost: z.number().nonnegative(),
    reorder: z.number().nonnegative(),
  }),
});

/**
 * Schema for SKU generation input
 */
export const generateSKUSchema = z.object({
  baseName: z.string().min(1).max(200),
  attributeValues: z.array(
    z.object({
      name: z.string(),
      value: z.string(),
    })
  ),
  config: skuGeneratorConfigSchema,
});

/**
 * Schema for SKU uniqueness validation
 */
export const validateSKUUniquenessSchema = z.object({
  sku: z.string().min(1).max(100),
  organizationId: z.string().uuid(),
});

/**
 * Schema for calculating combinations count
 */
export const calculateCombinationsCountSchema = z.object({
  selectedAttributes: z.array(selectedAttributeSchema),
});

// ==========================================
// TYPE EXPORTS
// ==========================================

export type SelectedAttribute = z.infer<typeof selectedAttributeSchema>;
export type GeneratedVariant = z.infer<typeof generatedVariantSchema>;
export type SKUGeneratorConfig = z.infer<typeof skuGeneratorConfigSchema>;
export type GenerateVariantCombinationsInput = z.infer<typeof generateVariantCombinationsSchema>;
export type GenerateSKUInput = z.infer<typeof generateSKUSchema>;
export type ValidateSKUUniquenessInput = z.infer<typeof validateSKUUniquenessSchema>;
export type CalculateCombinationsCountInput = z.infer<typeof calculateCombinationsCountSchema>;
