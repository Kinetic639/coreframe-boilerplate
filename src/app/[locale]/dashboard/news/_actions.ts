"use server";

import { revalidatePath } from "next/cache";
import { getUserContext } from "@/lib/utils/assert-auth";
import { NewsService } from "@/server/services/news.service";
import {
  createNewsPostSchema,
  updateNewsPostSchema,
  newsFiltersSchema,
  type CreateNewsPostInput,
  type UpdateNewsPostInput,
  type NewsFilters,
} from "@/server/schemas/news.schema";

// ==========================================
// NEWS POST ACTIONS
// ==========================================

/**
 * Get all news posts for the organization
 */
export async function getNewsPostsAction(filters?: NewsFilters) {
  try {
    const { supabase, organizationId } = await getUserContext();

    // Validate filters if provided
    const validatedFilters = filters ? newsFiltersSchema.parse(filters) : {};

    const newsPosts = await NewsService.getNewsPosts(supabase, organizationId, validatedFilters);

    return { success: true, data: newsPosts };
  } catch (error) {
    console.error("[getNewsPostsAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch news posts",
    };
  }
}

/**
 * Get a single news post by ID
 */
export async function getNewsPostAction(newsId: string) {
  try {
    const { supabase, organizationId } = await getUserContext();

    const newsPost = await NewsService.getNewsPost(supabase, newsId, organizationId);

    if (!newsPost) {
      return { success: false, error: "News post not found" };
    }

    return { success: true, data: newsPost };
  } catch (error) {
    console.error("[getNewsPostAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch news post",
    };
  }
}

/**
 * Create a new news post
 */
export async function createNewsPostAction(
  input: Omit<CreateNewsPostInput, "organization_id" | "author_id">
) {
  try {
    const { supabase, organizationId, user } = await getUserContext();

    // Validate input
    const validatedInput = createNewsPostSchema.parse({
      ...input,
      organization_id: organizationId,
      author_id: user.id,
    });

    const newsPost = await NewsService.createNewsPost(supabase, validatedInput);

    // Revalidate news pages
    revalidatePath("/dashboard/start");
    revalidatePath("/dashboard/news");

    return { success: true, data: newsPost };
  } catch (error) {
    console.error("[createNewsPostAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create news post",
    };
  }
}

/**
 * Update a news post
 */
export async function updateNewsPostAction(newsId: string, input: UpdateNewsPostInput) {
  try {
    const { supabase, user } = await getUserContext();

    // Validate input
    const validatedInput = updateNewsPostSchema.parse(input);

    const newsPost = await NewsService.updateNewsPost(supabase, newsId, user.id, validatedInput);

    // Revalidate news pages
    revalidatePath("/dashboard/start");
    revalidatePath("/dashboard/news");
    revalidatePath(`/dashboard/news/${newsId}`);

    return { success: true, data: newsPost };
  } catch (error) {
    console.error("[updateNewsPostAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update news post",
    };
  }
}

/**
 * Delete a news post
 */
export async function deleteNewsPostAction(newsId: string) {
  try {
    const { supabase, user } = await getUserContext();

    await NewsService.deleteNewsPost(supabase, newsId, user.id);

    // Revalidate news pages
    revalidatePath("/dashboard/start");
    revalidatePath("/dashboard/news");

    return { success: true };
  } catch (error) {
    console.error("[deleteNewsPostAction] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete news post",
    };
  }
}
