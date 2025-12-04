import { useMutation } from "@tanstack/react-query";
import {
  generateVariantCombinationsAction,
  generateSKUAction,
  generateSKUsForAllVariantsAction,
  validateSKUUniquenessAction,
  calculateCombinationsCountAction,
  generatePreviewSKUAction,
} from "@/app/[locale]/dashboard/warehouse/products/variants/_actions";
import type {
  SelectedAttribute,
  GeneratedVariant,
  SKUGeneratorConfig,
} from "@/server/schemas/variant-generation.schema";

// ==========================================
// VARIANT GENERATION HOOKS
// ==========================================

/**
 * Hook to generate variant combinations
 * Pure business logic - no cache needed
 */
export function useGenerateVariantCombinations() {
  return useMutation({
    mutationFn: async ({
      baseName,
      selectedAttributes,
      defaultPrices,
    }: {
      baseName: string;
      selectedAttributes: SelectedAttribute[];
      defaultPrices: { selling: number; cost: number; reorder: number };
    }) => {
      const result = await generateVariantCombinationsAction(
        baseName,
        selectedAttributes,
        defaultPrices
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Hook to generate a single SKU
 * Pure business logic - no cache needed
 */
export function useGenerateSKU() {
  return useMutation({
    mutationFn: async ({
      baseName,
      attributeValues,
      config,
    }: {
      baseName: string;
      attributeValues: Array<{ name: string; value: string }>;
      config: SKUGeneratorConfig;
    }) => {
      const result = await generateSKUAction(baseName, attributeValues, config);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Hook to generate SKUs for all variants
 * Pure business logic - no cache needed
 */
export function useGenerateSKUsForAllVariants() {
  return useMutation({
    mutationFn: async ({
      baseName,
      variants,
      config,
    }: {
      baseName: string;
      variants: GeneratedVariant[];
      config: SKUGeneratorConfig;
    }) => {
      const result = await generateSKUsForAllVariantsAction(baseName, variants, config);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Hook to validate SKU uniqueness
 */
export function useValidateSKUUniqueness() {
  return useMutation({
    mutationFn: async (sku: string) => {
      const result = await validateSKUUniquenessAction(sku);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Hook to calculate combinations count
 * Pure business logic - no cache needed
 */
export function useCalculateCombinationsCount() {
  return useMutation({
    mutationFn: async (selectedAttributes: SelectedAttribute[]) => {
      const result = await calculateCombinationsCountAction(selectedAttributes);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}

/**
 * Hook to generate preview SKU
 * Pure business logic - no cache needed
 */
export function useGeneratePreviewSKU() {
  return useMutation({
    mutationFn: async ({
      baseName,
      sampleAttributes,
      config,
    }: {
      baseName: string;
      sampleAttributes: Array<{ name: string; value: string }>;
      config: SKUGeneratorConfig;
    }) => {
      const result = await generatePreviewSKUAction(baseName, sampleAttributes, config);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
  });
}
