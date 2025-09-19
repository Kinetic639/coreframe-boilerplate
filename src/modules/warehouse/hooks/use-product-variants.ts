import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { productService } from "../api/product-service";
import type {
  Variant,
  CreateVariantData,
  UpdateVariantData,
  VariantFilters,
} from "../types/variant-types";

// Query Keys - centralized for cache management
export const variantKeys = {
  all: ["variants"] as const,
  product: (productId: string) => [...variantKeys.all, "product", productId] as const,
  variant: (variantId: string) => [...variantKeys.all, "variant", variantId] as const,
  lists: () => [...variantKeys.all, "list"] as const,
  list: (productId: string, filters?: VariantFilters) =>
    [...variantKeys.lists(), productId, filters] as const,
};

// ===== QUERY HOOKS =====

/**
 * Get a product with all its variants
 */
export function useProduct(productId: string) {
  return useQuery({
    queryKey: variantKeys.product(productId),
    queryFn: () => productService.getProduct(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get variants for a specific product with optional filters
 */
export function useProductVariants(productId: string, filters?: VariantFilters) {
  return useQuery({
    queryKey: variantKeys.list(productId, filters),
    queryFn: () => productService.getVariants(productId, filters),
    enabled: !!productId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Get a single variant by ID
 */
export function useVariant(variantId: string) {
  return useQuery({
    queryKey: variantKeys.variant(variantId),
    queryFn: () => productService.getVariant(variantId),
    enabled: !!variantId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ===== MUTATION HOOKS =====

/**
 * Create a new variant
 */
export function useCreateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ productId, data }: { productId: string; data: CreateVariantData }) =>
      productService.createVariant(productId, data),
    onSuccess: (newVariant, { productId }) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: variantKeys.product(productId) });
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() });

      // Optimistically add to cache
      queryClient.setQueryData(variantKeys.variant(newVariant.id), newVariant);

      toast.success("Variant created successfully");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to create variant";
      toast.error(message);
    },
  });
}

/**
 * Update an existing variant
 */
export function useUpdateVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateVariantData) => productService.updateVariant(data.id, data),
    onSuccess: (updatedVariant) => {
      // Update specific variant in cache
      queryClient.setQueryData(variantKeys.variant(updatedVariant.id), updatedVariant);

      // Invalidate product and list queries
      queryClient.invalidateQueries({ queryKey: variantKeys.product(updatedVariant.product_id) });
      queryClient.invalidateQueries({ queryKey: variantKeys.lists() });

      toast.success("Variant updated successfully");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to update variant";
      toast.error(message);
    },
  });
}

/**
 * Delete a variant
 */
export function useDeleteVariant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (variantId: string) => productService.deleteVariant(variantId),
    onSuccess: (_, variantId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: variantKeys.variant(variantId) });

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: variantKeys.all });

      toast.success("Variant deleted successfully");
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Failed to delete variant";
      toast.error(message);
    },
  });
}

// ===== UTILITY HOOKS =====

/**
 * Get variants with optimistic updates
 * Useful for forms that need immediate feedback
 */
export function useOptimisticVariants(productId: string) {
  const { data: variantsData, ...query } = useProductVariants(productId);
  const queryClient = useQueryClient();

  const addOptimisticVariant = (tempVariant: Partial<Variant>) => {
    const currentData = queryClient.getQueryData(variantKeys.list(productId)) as
      | { variants: Variant[]; total: number }
      | undefined;
    if (currentData && currentData.variants) {
      const optimisticVariant: Variant = {
        id: `temp-${Date.now()}`,
        product_id: productId,
        name: tempVariant.name || "New Variant",
        slug: "temp-slug",
        sku: tempVariant.sku,
        barcode: tempVariant.barcode,
        is_default: false,
        status: "active",
        attributes: tempVariant.attributes || {},
        stock_quantity: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...tempVariant,
      };

      queryClient.setQueryData(variantKeys.list(productId), {
        ...currentData,
        variants: [...(currentData.variants || []), optimisticVariant],
        total: (currentData.total || 0) + 1,
      });
    }
  };

  return {
    ...query,
    data: variantsData,
    addOptimisticVariant,
  };
}

/**
 * Prefetch variants for better UX
 */
export function usePrefetchVariants() {
  const queryClient = useQueryClient();

  const prefetchProduct = (productId: string) => {
    queryClient.prefetchQuery({
      queryKey: variantKeys.product(productId),
      queryFn: () => productService.getProduct(productId),
      staleTime: 5 * 60 * 1000,
    });
  };

  const prefetchVariants = (productId: string, filters?: VariantFilters) => {
    queryClient.prefetchQuery({
      queryKey: variantKeys.list(productId, filters),
      queryFn: () => productService.getVariants(productId, filters),
      staleTime: 2 * 60 * 1000,
    });
  };

  return { prefetchProduct, prefetchVariants };
}
