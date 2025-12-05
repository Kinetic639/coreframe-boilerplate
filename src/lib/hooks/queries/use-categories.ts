import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getCategories,
  getCategoryById,
  getDefaultCategory,
  getFirstCategory,
  createCategory,
  updateCategory,
  checkDeletion,
  deleteCategory,
  reorderCategories,
  moveCategory,
  togglePreferred,
  getPreferredCategories,
  countProducts,
  countChildren,
} from "@/app/[locale]/dashboard/warehouse/categories/_actions";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
  ReorderCategoriesInput,
  MoveCategoryInput,
} from "@/server/schemas/categories.schema";

/**
 * Hook to fetch all categories as tree
 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      return await getCategories();
    },
    staleTime: 10 * 60 * 1000, // 10 minutes (categories don't change often)
  });
}

/**
 * Hook to fetch single category by ID
 */
export function useCategory(categoryId: string | null) {
  return useQuery({
    queryKey: ["category", categoryId],
    queryFn: async () => {
      if (!categoryId) return null;
      return await getCategoryById(categoryId);
    },
    enabled: !!categoryId,
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch default category
 */
export function useDefaultCategory() {
  return useQuery({
    queryKey: ["default-category"],
    queryFn: async () => {
      return await getDefaultCategory();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes (rarely changes)
  });
}

/**
 * Hook to fetch first non-default category
 */
export function useFirstCategory() {
  return useQuery({
    queryKey: ["first-category"],
    queryFn: async () => {
      return await getFirstCategory();
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to fetch preferred categories
 */
export function usePreferredCategories() {
  return useQuery({
    queryKey: ["preferred-categories"],
    queryFn: async () => {
      return await getPreferredCategories();
    },
    staleTime: 10 * 60 * 1000,
  });
}

/**
 * Hook to create a new category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateCategoryInput) => {
      return await createCategory(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["first-category"] });
      toast.success("Category created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create category");
    },
  });
}

/**
 * Hook to update a category
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      categoryId,
      input,
    }: {
      categoryId: string;
      input: UpdateCategoryInput;
    }) => {
      return await updateCategory(categoryId, input);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["category", variables.categoryId] });
      toast.success("Category updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update category");
    },
  });
}

/**
 * Hook to check deletion requirements
 */
export function useCheckDeletion() {
  return useMutation({
    mutationFn: async (categoryId: string) => {
      return await checkDeletion(categoryId);
    },
  });
}

/**
 * Hook to delete a category
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      return await deleteCategory(categoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["first-category"] });
      queryClient.invalidateQueries({ queryKey: ["preferred-categories"] });
      toast.success("Category deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete category");
    },
  });
}

/**
 * Hook to reorder categories
 */
export function useReorderCategories() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReorderCategoriesInput) => {
      return await reorderCategories(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Categories reordered successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to reorder categories");
    },
  });
}

/**
 * Hook to move category to different parent
 */
export function useMoveCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MoveCategoryInput) => {
      return await moveCategory(input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      toast.success("Category moved successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to move category");
    },
  });
}

/**
 * Hook to toggle preferred status
 */
export function useTogglePreferred() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      return await togglePreferred(categoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["preferred-categories"] });
      toast.success("Preferred status updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update preferred status");
    },
  });
}

/**
 * Hook to count products in category
 */
export function useCountProducts(categoryId: string | null) {
  return useQuery({
    queryKey: ["category-product-count", categoryId],
    queryFn: async () => {
      if (!categoryId) return 0;
      return await countProducts(categoryId);
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to count child categories
 */
export function useCountChildren(categoryId: string | null) {
  return useQuery({
    queryKey: ["category-children-count", categoryId],
    queryFn: async () => {
      if (!categoryId) return 0;
      return await countChildren(categoryId);
    },
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
  });
}
