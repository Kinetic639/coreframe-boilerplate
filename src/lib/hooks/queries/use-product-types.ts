import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getProductTypesAction,
  getProductTypeAction,
  getProductTypeBySlugAction,
  createProductTypeAction,
  updateProductTypeAction,
  deleteProductTypeAction,
} from "@/app/[locale]/dashboard/warehouse/settings/product-types/_actions";
import type {
  CreateProductTypeInput,
  UpdateProductTypeInput,
} from "@/server/schemas/product-types.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const productTypesKeys = {
  all: ["product-types"] as const,
  lists: () => [...productTypesKeys.all, "list"] as const,
  list: () => [...productTypesKeys.lists()] as const,
  details: () => [...productTypesKeys.all, "detail"] as const,
  detail: (id: string) => [...productTypesKeys.details(), id] as const,
  bySlug: (slug: string) => [...productTypesKeys.details(), "by-slug", slug] as const,
};

// ==========================================
// PRODUCT TYPES QUERIES
// ==========================================

/**
 * Hook to fetch all product types
 */
export function useProductTypes() {
  return useQuery({
    queryKey: productTypesKeys.list(),
    queryFn: async () => {
      const result = await getProductTypesAction();

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to fetch a single product type by ID
 */
export function useProductType(productTypeId: string | null) {
  return useQuery({
    queryKey: productTypesKeys.detail(productTypeId || ""),
    queryFn: async () => {
      if (!productTypeId) {
        throw new Error("Product type ID is required");
      }

      const result = await getProductTypeAction(productTypeId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!productTypeId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook to fetch a product type by slug
 */
export function useProductTypeBySlug(slug: string | null) {
  return useQuery({
    queryKey: productTypesKeys.bySlug(slug || ""),
    queryFn: async () => {
      if (!slug) {
        throw new Error("Product type slug is required");
      }

      const result = await getProductTypeBySlugAction(slug);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
  });
}

// ==========================================
// PRODUCT TYPES MUTATIONS
// ==========================================

/**
 * Hook to create a new product type
 */
export function useCreateProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateProductTypeInput, "organization_id">) => {
      const result = await createProductTypeAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productTypesKeys.lists() });
      toast.success("Product type created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create product type");
    },
  });
}

/**
 * Hook to update a product type
 */
export function useUpdateProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      productTypeId,
      input,
    }: {
      productTypeId: string;
      input: UpdateProductTypeInput;
    }) => {
      const result = await updateProductTypeAction(productTypeId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: productTypesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: productTypesKeys.detail(data.id) });
      if (data.slug) {
        queryClient.invalidateQueries({ queryKey: productTypesKeys.bySlug(data.slug) });
      }
      toast.success("Product type updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update product type");
    },
  });
}

/**
 * Hook to delete a product type
 */
export function useDeleteProductType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productTypeId: string) => {
      const result = await deleteProductTypeAction(productTypeId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, productTypeId) => {
      queryClient.invalidateQueries({ queryKey: productTypesKeys.lists() });
      queryClient.removeQueries({ queryKey: productTypesKeys.detail(productTypeId) });
      toast.success("Product type deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete product type");
    },
  });
}
