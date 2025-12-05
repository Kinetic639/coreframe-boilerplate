import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  createProductGroupAction,
  getProductGroupByIdAction,
  updateVariantAction,
  deleteVariantAction,
  deleteProductGroupAction,
  adjustVariantStockAction,
  bulkUpdateVariantsAction,
  getVariantsByProductIdAction,
} from "@/app/[locale]/dashboard/warehouse/products/groups/_actions";
import type {
  CreateProductGroupInput,
  UpdateVariantInput,
  BulkUpdateVariantsInput,
  StockAdjustmentInput,
} from "@/server/schemas/product-groups.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const productGroupKeys = {
  all: ["product-groups"] as const,
  detail: (id: string) => [...productGroupKeys.all, "detail", id] as const,
  variants: (productId: string) => [...productGroupKeys.all, "variants", productId] as const,
};

// ==========================================
// QUERIES
// ==========================================

/**
 * Get product group by ID with all variants and details
 */
export function useProductGroup(productId: string | null) {
  return useQuery({
    queryKey: productGroupKeys.detail(productId || ""),
    queryFn: async () => {
      if (!productId) return null;

      const result = await getProductGroupByIdAction(productId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!productId,
  });
}

/**
 * Get all variants for a product group
 */
export function useProductGroupVariants(productId: string | null) {
  return useQuery({
    queryKey: productGroupKeys.variants(productId || ""),
    queryFn: async () => {
      if (!productId) return [];

      const result = await getVariantsByProductIdAction(productId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!productId,
  });
}

// ==========================================
// MUTATIONS
// ==========================================

/**
 * Create a new product group
 */
export function useCreateProductGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductGroupInput) => {
      const result = await createProductGroupAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      toast.success("Product group created successfully");
      queryClient.invalidateQueries({ queryKey: productGroupKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create product group");
    },
  });
}

/**
 * Update a variant
 */
export function useUpdateVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ variantId, data }: { variantId: string; data: UpdateVariantInput }) => {
      const result = await updateVariantAction(variantId, data);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      toast.success("Variant updated successfully");
      queryClient.invalidateQueries({ queryKey: productGroupKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productGroupKeys.variants(productId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update variant");
    },
  });
}

/**
 * Delete a variant
 */
export function useDeleteVariant(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (variantId: string) => {
      const result = await deleteVariantAction(variantId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      toast.success("Variant deleted successfully");
      queryClient.invalidateQueries({ queryKey: productGroupKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productGroupKeys.variants(productId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete variant");
    },
  });
}

/**
 * Delete a product group
 */
export function useDeleteProductGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const result = await deleteProductGroupAction(productId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      toast.success("Product group deleted successfully");
      queryClient.invalidateQueries({ queryKey: productGroupKeys.all });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete product group");
    },
  });
}

/**
 * Adjust stock for a variant
 * @deprecated Use stock movements service instead
 */
export function useAdjustVariantStock(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: StockAdjustmentInput) => {
      const result = await adjustVariantStockAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      toast.success("Stock adjusted successfully");
      queryClient.invalidateQueries({ queryKey: productGroupKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productGroupKeys.variants(productId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to adjust stock");
    },
  });
}

/**
 * Bulk update variants
 */
export function useBulkUpdateVariants(productId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BulkUpdateVariantsInput) => {
      const result = await bulkUpdateVariantsAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      toast.success("Variants updated successfully");
      queryClient.invalidateQueries({ queryKey: productGroupKeys.detail(productId) });
      queryClient.invalidateQueries({ queryKey: productGroupKeys.variants(productId) });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update variants");
    },
  });
}
