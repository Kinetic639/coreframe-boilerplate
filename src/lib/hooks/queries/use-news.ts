import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import {
  getNewsPostsAction,
  getNewsPostAction,
  createNewsPostAction,
  updateNewsPostAction,
  deleteNewsPostAction,
} from "@/app/[locale]/dashboard/news/_actions";
import type {
  CreateNewsPostInput,
  UpdateNewsPostInput,
  NewsFilters,
} from "@/server/schemas/news.schema";

// ==========================================
// QUERY KEYS
// ==========================================

export const newsKeys = {
  all: ["news"] as const,
  lists: () => [...newsKeys.all, "list"] as const,
  list: (filters?: NewsFilters) => [...newsKeys.lists(), filters] as const,
  details: () => [...newsKeys.all, "detail"] as const,
  detail: (id: string) => [...newsKeys.details(), id] as const,
};

// ==========================================
// NEWS QUERIES
// ==========================================

/**
 * Hook to fetch all news posts
 */
export function useNewsPosts(filters?: NewsFilters) {
  return useQuery({
    queryKey: newsKeys.list(filters),
    queryFn: async () => {
      const result = await getNewsPostsAction(filters);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes - news should be relatively fresh
  });
}

/**
 * Hook to fetch a single news post by ID
 */
export function useNewsPost(newsId: string | null) {
  return useQuery({
    queryKey: newsKeys.detail(newsId || ""),
    queryFn: async () => {
      if (!newsId) {
        throw new Error("News ID is required");
      }

      const result = await getNewsPostAction(newsId);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: !!newsId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// ==========================================
// NEWS MUTATIONS
// ==========================================

/**
 * Hook to create a new news post
 */
export function useCreateNewsPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<CreateNewsPostInput, "organization_id" | "author_id">) => {
      const result = await createNewsPostAction(input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: newsKeys.lists() });
      toast.success("News post created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create news post");
    },
  });
}

/**
 * Hook to update a news post
 */
export function useUpdateNewsPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ newsId, input }: { newsId: string; input: UpdateNewsPostInput }) => {
      const result = await updateNewsPostAction(newsId, input);

      if (!result.success) {
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: newsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: newsKeys.detail(data.id) });
      toast.success("News post updated successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update news post");
    },
  });
}

/**
 * Hook to delete a news post
 */
export function useDeleteNewsPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (newsId: string) => {
      const result = await deleteNewsPostAction(newsId);

      if (!result.success) {
        throw new Error(result.error);
      }
    },
    onSuccess: (_, newsId) => {
      queryClient.invalidateQueries({ queryKey: newsKeys.lists() });
      queryClient.removeQueries({ queryKey: newsKeys.detail(newsId) });
      toast.success("News post deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete news post");
    },
  });
}
