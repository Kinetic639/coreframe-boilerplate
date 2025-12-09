"use server";

import { VariantGenerationService } from "@/server/services/variant-generation.service";
import { getUserContext } from "@/lib/utils/assert-auth";
import {
  generateVariantCombinationsSchema,
  generateSKUSchema,
  validateSKUUniquenessSchema,
  calculateCombinationsCountSchema,
  type GeneratedVariant,
  type SelectedAttribute,
  type SKUGeneratorConfig,
} from "@/server/schemas/variant-generation.schema";

// ==========================================
// VARIANT GENERATION SERVER ACTIONS
// ==========================================

/**
 * Generate variant combinations from selected attributes
 */
export async function generateVariantCombinationsAction(
  baseName: string,
  selectedAttributes: SelectedAttribute[],
  defaultPrices: { selling: number; cost: number; reorder: number }
) {
  try {
    // Validate input
    const validatedInput = generateVariantCombinationsSchema.parse({
      baseName,
      selectedAttributes,
      defaultPrices,
    });

    // No auth needed - pure business logic
    const variants = VariantGenerationService.generateVariantCombinations(
      validatedInput.baseName,
      validatedInput.selectedAttributes,
      validatedInput.defaultPrices as { selling: number; cost: number; reorder: number }
    );

    return { success: true, data: variants };
  } catch (error) {
    console.error("[generateVariantCombinationsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate variant combinations",
    };
  }
}

/**
 * Generate SKU for a single variant
 */
export async function generateSKUAction(
  baseName: string,
  attributeValues: Array<{ name: string; value: string }>,
  config: SKUGeneratorConfig
) {
  try {
    // Validate input
    const validatedInput = generateSKUSchema.parse({
      baseName,
      attributeValues,
      config,
    });

    // No auth needed - pure business logic
    const sku = VariantGenerationService.generateSKU(
      validatedInput.baseName,
      validatedInput.attributeValues as Array<{ name: string; value: string }>,
      validatedInput.config
    );

    return { success: true, data: sku };
  } catch (error) {
    console.error("[generateSKUAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate SKU",
    };
  }
}

/**
 * Generate SKUs for all variants
 */
export async function generateSKUsForAllVariantsAction(
  baseName: string,
  variants: GeneratedVariant[],
  config: SKUGeneratorConfig
) {
  try {
    // No auth needed - pure business logic
    const variantsWithSKUs = VariantGenerationService.generateSKUsForAllVariants(
      baseName,
      variants,
      config
    );

    return { success: true, data: variantsWithSKUs };
  } catch (error) {
    console.error("[generateSKUsForAllVariantsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate SKUs for variants",
    };
  }
}

/**
 * Validate SKU uniqueness in the organization
 */
export async function validateSKUUniquenessAction(sku: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate input
    const validatedInput = validateSKUUniquenessSchema.parse({
      sku,
      organizationId,
    });

    const result = await VariantGenerationService.validateSKUUniqueness(
      supabase,
      validatedInput.sku,
      validatedInput.organizationId
    );

    return { success: true, data: result };
  } catch (error) {
    console.error("[validateSKUUniquenessAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate SKU uniqueness",
    };
  }
}

/**
 * Calculate total combinations count
 */
export async function calculateCombinationsCountAction(selectedAttributes: SelectedAttribute[]) {
  try {
    // Validate input
    const validatedInput = calculateCombinationsCountSchema.parse({
      selectedAttributes,
    });

    // No auth needed - pure calculation
    const count = VariantGenerationService.calculateCombinationsCount(
      validatedInput.selectedAttributes
    );

    return { success: true, data: count };
  } catch (error) {
    console.error("[calculateCombinationsCountAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to calculate combinations count",
    };
  }
}

/**
 * Generate preview SKU
 */
export async function generatePreviewSKUAction(
  baseName: string,
  sampleAttributes: Array<{ name: string; value: string }>,
  config: SKUGeneratorConfig
) {
  try {
    // No auth needed - pure business logic
    const previewSKU = VariantGenerationService.generatePreviewSKU(
      baseName,
      sampleAttributes,
      config
    );

    return { success: true, data: previewSKU };
  } catch (error) {
    console.error("[generatePreviewSKUAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate preview SKU",
    };
  }
}
