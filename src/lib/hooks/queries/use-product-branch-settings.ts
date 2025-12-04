/**
 * Product Branch Settings React Query Hooks
 * Client-side hooks for per-warehouse product configuration
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getProductBranchSettingsAction,
  getSettingsForProductAction,
  getProductsForBranchAction,
  upsertProductBranchSettingsAction,
  updateProductBranchSettingsAction,
  deleteProductBranchSettingsAction,
  initializeForAllBranchesAction,
} from "@/app/[locale]/dashboard/warehouse/products/branch-settings/_actions";
import type {
  CreateProductBranchSettingsInput,
  UpdateProductBranchSettingsInput,
  InitializeForAllBranchesInput,
} from "@/server/schemas/product-branch-settings.schema";

// =====================================================
// QUERY KEYS
// =====================================================

export const productBranchSettingsKeys = {
  all: ["product-branch-settings"] as const,
  lists: () => [...productBranchSettingsKeys.all, "list"] as const,
  details: () => [...productBranchSettingsKeys.all, "detail"] as const,
  detail: (productId: string, branchId: string) =>
    [...productBranchSettingsKeys.details(), productId, branchId] as const,
  forProduct: (productId: string) =>
    [...productBranchSettingsKeys.all, "for-product", productId] as const,
  forBranch: (branchId: string) =>
    [...productBranchSettingsKeys.all, "for-branch", branchId] as const,
};

// =====================================================
// QUERY HOOKS
// =====================================================

/**
 * Get settings for a product in a specific branch
 */
export function useProductBranchSettings(productId: string | null, branchId: string | null) {
  return useQuery({
    queryKey: productBranchSettingsKeys.detail(productId || "", branchId || ""),
    queryFn: async () => {
      if (!productId || !branchId) {
        throw new Error("Product ID and Branch ID are required");
      }
      const result = await getProductBranchSettingsAction(productId, branchId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!productId && !!branchId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get all branch settings for a product (all warehouses)
 */
export function useSettingsForProduct(productId: string | null) {
  return useQuery({
    queryKey: productBranchSettingsKeys.forProduct(productId || ""),
    queryFn: async () => {
      if (!productId) throw new Error("Product ID is required");
      const result = await getSettingsForProductAction(productId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get all products with settings for a specific branch
 */
export function useProductsForBranch(branchId: string | null) {
  return useQuery({
    queryKey: productBranchSettingsKeys.forBranch(branchId || ""),
    queryFn: async () => {
      if (!branchId) throw new Error("Branch ID is required");
      const result = await getProductsForBranchAction(branchId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    enabled: !!branchId,
    staleTime: 3 * 60 * 1000, // 3 minutes
  });
}

// =====================================================
// MUTATION HOOKS
// =====================================================

/**
 * Create or update settings for a product in a branch
 */
export function useUpsertProductBranchSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProductBranchSettingsInput) => {
      const result = await upsertProductBranchSettingsAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success("Product settings saved successfully");
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.detail(data.product_id, data.branch_id),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forProduct(data.product_id),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forBranch(data.branch_id),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save settings: ${error.message}`);
    },
  });
}

/**
 * Update settings for a product in a branch
 */
export function useUpdateProductBranchSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productId,
      branchId,
      updates,
    }: {
      productId: string;
      branchId: string;
      updates: UpdateProductBranchSettingsInput;
    }) => {
      const result = await updateProductBranchSettingsAction(productId, branchId, updates);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success("Product settings updated successfully");
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.detail(data.product_id, data.branch_id),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forProduct(data.product_id),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forBranch(data.branch_id),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to update settings: ${error.message}`);
    },
  });
}

/**
 * Delete settings for a product in a branch
 */
export function useDeleteProductBranchSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, branchId }: { productId: string; branchId: string }) => {
      const result = await deleteProductBranchSettingsAction(productId, branchId);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data) => {
      toast.success("Product settings deleted successfully");
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.detail(data.productId, data.branchId),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forProduct(data.productId),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forBranch(data.branchId),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete settings: ${error.message}`);
    },
  });
}

/**
 * Initialize settings for a product across all branches
 */
export function useInitializeForAllBranches() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InitializeForAllBranchesInput) => {
      const result = await initializeForAllBranchesAction(input);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result.data;
    },
    onSuccess: (data, variables) => {
      toast.success("Product settings initialized for all branches");
      // Invalidate related queries
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.forProduct(variables.product_id),
      });
      queryClient.invalidateQueries({
        queryKey: productBranchSettingsKeys.lists(),
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to initialize settings: ${error.message}`);
    },
  });
}
