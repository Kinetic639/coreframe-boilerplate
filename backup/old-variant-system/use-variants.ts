import { useState, useCallback } from "react";
import { useProductStore } from "@/lib/stores/product-store";
import {
  variantService,
  type VariantMatrix,
  type VariantCombination,
  type VariantPricing,
  type VariantPerformance,
  type BulkVariantOperation,
} from "../api/variant-service";
import { flexibleProductService } from "../api/flexible-products";
import type { CreateVariantData, ProductWithDetails } from "../types/flexible-products";
import { toast } from "react-toastify";

interface UseVariantsState {
  // Loading states
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isBulkProcessing: boolean;
  isGeneratingCombinations: boolean;
  isUpdatingPricing: boolean;
  isLoadingPerformance: boolean;
  isGeneratingSkus: boolean;
  isComparing: boolean;

  // Error states
  error: string | null;
  bulkError: string | null;

  // Data states
  generatedCombinations: VariantCombination[];
  variantPerformance: VariantPerformance[];
  comparisonData: {
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      barcode?: string;
      status: string;
      attributes?: Array<{ attribute_key: string }>;
      stock_snapshots?: Array<{
        quantity_on_hand?: number;
        quantity_reserved?: number;
        total_value?: number;
      }>;
      images?: unknown[];
    }>;
    comparison_matrix: Record<string, unknown[]>;
  } | null;
  skuGenerationResults: { variant_id: string; generated_sku: string }[];
}

interface UseVariantsActions {
  // Basic CRUD
  createVariant: (variantData: CreateVariantData) => Promise<ProductWithDetails>;
  updateVariant: (
    variantId: string,
    variantData: Partial<CreateVariantData>
  ) => Promise<ProductWithDetails>;
  deleteVariant: (variantId: string) => Promise<void>;

  // Bulk operations
  createVariantBatch: (
    productId: string,
    variants: VariantCombination[],
    options?: { skip_existing?: boolean; validate_unique_sku?: boolean }
  ) => Promise<ProductWithDetails>;
  updateVariantPricing: (pricingUpdates: VariantPricing[]) => Promise<void>;
  generateVariantSkus: (
    productId: string,
    pattern?: string
  ) => Promise<{ variant_id: string; generated_sku: string }[]>;

  // Matrix generation
  generateCombinations: (
    matrix: VariantMatrix,
    baseProduct: { id: string; name: string },
    options?: { sku_pattern?: string; name_pattern?: string; auto_pricing?: boolean }
  ) => VariantCombination[];
  createFromMatrix: (
    productId: string,
    matrix: VariantMatrix,
    options?: { sku_pattern?: string; name_pattern?: string; auto_pricing?: boolean }
  ) => Promise<ProductWithDetails>;

  // Analytics & comparison
  loadVariantPerformance: (
    productId: string,
    dateRange?: { from: string; to: string }
  ) => Promise<VariantPerformance[]>;
  compareVariants: (variantIds: string[]) => Promise<{
    variants: Array<{
      id: string;
      name: string;
      sku: string;
      barcode?: string;
      status: string;
      attributes?: Array<{ attribute_key: string }>;
      stock_snapshots?: Array<{
        quantity_on_hand?: number;
        quantity_reserved?: number;
        total_value?: number;
      }>;
      images?: unknown[];
    }>;
    comparison_matrix: Record<string, unknown[]>;
  }>;

  // Utility actions
  clearError: () => void;
  clearComparisonData: () => void;
  resetState: () => void;
}

export type UseVariants = UseVariantsState & UseVariantsActions;

const initialState: UseVariantsState = {
  isCreating: false,
  isUpdating: false,
  isDeleting: false,
  isBulkProcessing: false,
  isGeneratingCombinations: false,
  isUpdatingPricing: false,
  isLoadingPerformance: false,
  isGeneratingSkus: false,
  isComparing: false,

  error: null,
  bulkError: null,

  generatedCombinations: [],
  variantPerformance: [],
  comparisonData: null,
  skuGenerationResults: [],
};

export const useVariants = (): UseVariants => {
  const [state, setState] = useState<UseVariantsState>(initialState);
  const { currentProduct } = useProductStore();

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, bulkError: null }));
  }, []);

  const clearComparisonData = useCallback(() => {
    setState((prev) => ({ ...prev, comparisonData: null }));
  }, []);

  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  // Basic CRUD operations
  const createVariant = useCallback(
    async (variantData: CreateVariantData): Promise<ProductWithDetails> => {
      setState((prev) => ({ ...prev, isCreating: true, error: null }));

      try {
        const updatedProduct = await flexibleProductService.createVariant(variantData);

        toast.success("Variant created successfully");
        setState((prev) => ({ ...prev, isCreating: false }));

        return updatedProduct;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to create variant";
        setState((prev) => ({ ...prev, error: errorMessage, isCreating: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  const updateVariant = useCallback(
    async (
      variantId: string,
      variantData: Partial<CreateVariantData>
    ): Promise<ProductWithDetails> => {
      setState((prev) => ({ ...prev, isUpdating: true, error: null }));

      try {
        const updatedProduct = await flexibleProductService.updateVariant(variantId, variantData);

        toast.success("Variant updated successfully");
        setState((prev) => ({ ...prev, isUpdating: false }));

        return updatedProduct;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to update variant";
        setState((prev) => ({ ...prev, error: errorMessage, isUpdating: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  const deleteVariant = useCallback(async (variantId: string): Promise<void> => {
    setState((prev) => ({ ...prev, isDeleting: true, error: null }));

    try {
      await flexibleProductService.deleteVariant(variantId);

      toast.success("Variant deleted successfully");
      setState((prev) => ({ ...prev, isDeleting: false }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to delete variant";
      setState((prev) => ({ ...prev, error: errorMessage, isDeleting: false }));
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Bulk operations
  const createVariantBatch = useCallback(
    async (
      productId: string,
      variants: VariantCombination[],
      options?: { skip_existing?: boolean; validate_unique_sku?: boolean }
    ): Promise<ProductWithDetails> => {
      setState((prev) => ({ ...prev, isBulkProcessing: true, bulkError: null }));

      try {
        const updatedProduct = await variantService.createVariantBatch(
          productId,
          variants,
          options
        );

        toast.success(`${variants.length} variants created successfully`);
        setState((prev) => ({ ...prev, isBulkProcessing: false }));

        return updatedProduct;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create variant batch";
        setState((prev) => ({ ...prev, bulkError: errorMessage, isBulkProcessing: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  const updateVariantPricing = useCallback(
    async (pricingUpdates: VariantPricing[]): Promise<void> => {
      setState((prev) => ({ ...prev, isUpdatingPricing: true, error: null }));

      try {
        await variantService.updateVariantPricing(pricingUpdates);

        toast.success(`Pricing updated for ${pricingUpdates.length} variants`);
        setState((prev) => ({ ...prev, isUpdatingPricing: false }));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to update variant pricing";
        setState((prev) => ({ ...prev, error: errorMessage, isUpdatingPricing: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  const generateVariantSkus = useCallback(
    async (
      productId: string,
      pattern?: string
    ): Promise<{ variant_id: string; generated_sku: string }[]> => {
      setState((prev) => ({ ...prev, isGeneratingSkus: true, error: null }));

      try {
        const results = await variantService.generateVariantSkus(productId, pattern);

        toast.success(`Generated SKUs for ${results.length} variants`);
        setState((prev) => ({
          ...prev,
          isGeneratingSkus: false,
          skuGenerationResults: results,
        }));

        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate variant SKUs";
        setState((prev) => ({ ...prev, error: errorMessage, isGeneratingSkus: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  // Matrix generation
  const generateCombinations = useCallback(
    (
      matrix: VariantMatrix,
      baseProduct: { id: string; name: string },
      options?: { sku_pattern?: string; name_pattern?: string; auto_pricing?: boolean }
    ): VariantCombination[] => {
      setState((prev) => ({ ...prev, isGeneratingCombinations: true, error: null }));

      try {
        const combinations = variantService.generateVariantCombinations(
          matrix,
          baseProduct,
          options
        );

        setState((prev) => ({
          ...prev,
          isGeneratingCombinations: false,
          generatedCombinations: combinations,
        }));

        return combinations;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to generate combinations";
        setState((prev) => ({ ...prev, error: errorMessage, isGeneratingCombinations: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  const createFromMatrix = useCallback(
    async (
      productId: string,
      matrix: VariantMatrix,
      options?: { sku_pattern?: string; name_pattern?: string; auto_pricing?: boolean }
    ): Promise<ProductWithDetails> => {
      setState((prev) => ({ ...prev, isBulkProcessing: true, error: null }));

      try {
        // First generate combinations
        const baseProduct = currentProduct || { id: productId, name: "Product" };
        const combinations = variantService.generateVariantCombinations(
          matrix,
          baseProduct,
          options
        );

        // Then create them in batch
        const updatedProduct = await variantService.createVariantBatch(productId, combinations, {
          skip_existing: true,
          validate_unique_sku: true,
        });

        toast.success(`Created ${combinations.length} variants from matrix`);
        setState((prev) => ({
          ...prev,
          isBulkProcessing: false,
          generatedCombinations: combinations,
        }));

        return updatedProduct;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to create variants from matrix";
        setState((prev) => ({ ...prev, error: errorMessage, isBulkProcessing: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    [currentProduct]
  );

  // Analytics & comparison
  const loadVariantPerformance = useCallback(
    async (
      productId: string,
      dateRange?: { from: string; to: string }
    ): Promise<VariantPerformance[]> => {
      setState((prev) => ({ ...prev, isLoadingPerformance: true, error: null }));

      try {
        const performance = await variantService.getVariantPerformance(productId, dateRange);

        setState((prev) => ({
          ...prev,
          isLoadingPerformance: false,
          variantPerformance: performance,
        }));

        return performance;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to load variant performance";
        setState((prev) => ({ ...prev, error: errorMessage, isLoadingPerformance: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  const compareVariants = useCallback(
    async (
      variantIds: string[]
    ): Promise<{
      variants: Array<{
        id: string;
        name: string;
        sku: string;
        barcode?: string;
        status: string;
        attributes?: Array<{ attribute_key: string }>;
        stock_snapshots?: Array<{
          quantity_on_hand?: number;
          quantity_reserved?: number;
          total_value?: number;
        }>;
        images?: unknown[];
      }>;
      comparison_matrix: Record<string, unknown[]>;
    }> => {
      setState((prev) => ({ ...prev, isComparing: true, error: null }));

      try {
        const comparisonData = await variantService.compareVariants(variantIds);

        setState((prev) => ({
          ...prev,
          isComparing: false,
          comparisonData,
        }));

        return comparisonData;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Failed to compare variants";
        setState((prev) => ({ ...prev, error: errorMessage, isComparing: false }));
        toast.error(errorMessage);
        throw error;
      }
    },
    []
  );

  return {
    ...state,
    createVariant,
    updateVariant,
    deleteVariant,
    createVariantBatch,
    updateVariantPricing,
    generateVariantSkus,
    generateCombinations,
    createFromMatrix,
    loadVariantPerformance,
    compareVariants,
    clearError,
    clearComparisonData,
    resetState,
  };
};

// Additional specialized hooks for specific use cases

/**
 * Hook for managing variant matrix generation
 */
export const useVariantMatrix = () => {
  const { generateCombinations, generatedCombinations, isGeneratingCombinations, error } =
    useVariants();

  const buildMatrix = useCallback(
    (attributes: { name: string; values: string[] }[]): VariantMatrix => {
      const matrix: VariantMatrix = {
        attributes: attributes.map((attr) => attr.name),
        combinations: {},
      };

      attributes.forEach((attr) => {
        matrix.combinations[attr.name] = attr.values;
      });

      return matrix;
    },
    []
  );

  return {
    buildMatrix,
    generateCombinations,
    generatedCombinations,
    isGeneratingCombinations,
    error,
  };
};

/**
 * Hook for bulk variant operations
 */
export const useBulkVariants = () => {
  const {
    createVariantBatch,
    updateVariantPricing,
    generateVariantSkus,
    isBulkProcessing,
    isUpdatingPricing,
    isGeneratingSkus,
    bulkError,
    skuGenerationResults,
  } = useVariants();

  const processBulkOperation = useCallback(
    async (operation: BulkVariantOperation) => {
      switch (operation.operation) {
        case "create":
          // For create operations, we need a product_id from the operation itself
          if (!operation.options?.product_id) {
            throw new Error("Product ID required for bulk create operation");
          }
          return await createVariantBatch(
            operation.options.product_id,
            operation.variants as VariantCombination[],
            {
              skip_existing: operation.options?.skip_existing,
              validate_unique_sku: operation.options?.validate_unique_sku,
            }
          );

        case "price_update":
          return await updateVariantPricing(operation.variants as VariantPricing[]);

        default:
          throw new Error(`Unsupported bulk operation: ${operation.operation}`);
      }
    },
    [createVariantBatch, updateVariantPricing]
  );

  return {
    processBulkOperation,
    createVariantBatch,
    updateVariantPricing,
    generateVariantSkus,
    isBulkProcessing,
    isUpdatingPricing,
    isGeneratingSkus,
    bulkError,
    skuGenerationResults,
  };
};

/**
 * Hook for variant analytics and performance
 */
export const useVariantAnalytics = () => {
  const {
    loadVariantPerformance,
    compareVariants,
    variantPerformance,
    comparisonData,
    isLoadingPerformance,
    isComparing,
    clearComparisonData,
    error,
  } = useVariants();

  const getTopPerformingVariants = useCallback(
    (limit: number = 5) => {
      return [...variantPerformance]
        .sort((a, b) => b.performance_score - a.performance_score)
        .slice(0, limit);
    },
    [variantPerformance]
  );

  const getLowStockVariants = useCallback(
    (threshold: number = 10) => {
      return variantPerformance.filter((v) => v.current_stock <= threshold);
    },
    [variantPerformance]
  );

  return {
    loadVariantPerformance,
    compareVariants,
    getTopPerformingVariants,
    getLowStockVariants,
    variantPerformance,
    comparisonData,
    isLoadingPerformance,
    isComparing,
    clearComparisonData,
    error,
  };
};
