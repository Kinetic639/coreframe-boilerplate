"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import type { AnnouncementFormData } from "@/components/announcements/AnnouncementForm";

export async function getAnnouncementPosts(limit?: number, offset?: number) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      console.error("No session found");
      throw new Error("Unauthorized - no session");
    }

    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      console.error("No active organization in context");
      throw new Error("No active organization");
    }

    console.log("Fetching news posts for org:", appContext.activeOrgId, "user:", session.user.id);

    let query = supabase
      .from("news_posts")
      .select("*")
      .eq("organization_id", appContext.activeOrgId)
      .order("published_at", { ascending: false });

    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + (limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error fetching news posts:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log("Successfully fetched news posts:", data?.length || 0, "items");

    // Get all unique author IDs
    const authorIds = [...new Set(data?.map((post) => post.author_id).filter(Boolean))];

    // Fetch all author information in one query
    const authorsMap = new Map();
    if (authorIds.length > 0) {
      try {
        const { data: authors } = await supabase
          .from("users")
          .select("id, email, first_name, last_name")
          .in("id", authorIds);

        authors?.forEach((author) => {
          const displayName =
            `${author.first_name || ""} ${author.last_name || ""}`.trim() ||
            author.email ||
            "Unknown";
          authorsMap.set(author.id, {
            name: displayName,
            email: author.email,
          });
        });
      } catch (error) {
        console.warn("Could not fetch author info:", error);
      }
    }

    // Transform the data to include author information
    const transformedData =
      data?.map((post) => ({
        ...post,
        author_name: authorsMap.get(post.author_id)?.name || "Unknown",
        author_email: authorsMap.get(post.author_id)?.email || null,
        author_avatar: null,
      })) || [];

    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Error in getNewsPosts:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch news posts",
    };
  }
}

export async function createAnnouncementPost(formData: AnnouncementFormData) {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      console.error("No session found for news post creation");
      throw new Error("Unauthorized - no session");
    }

    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      console.error("No active organization for news post creation");
      throw new Error("No active organization");
    }

    console.log("Creating news post for org:", appContext.activeOrgId, "user:", session.user.id);

    const user = session.user;

    const newsData = {
      title: formData.title,
      content: JSON.parse(formData.content), // Parse the JSON string from Lexical
      excerpt: formData.excerpt || null,
      priority: formData.priority,
      badges: formData.badges,
      author_id: user.id,
      organization_id: appContext.activeOrgId,
      branch_id: null, // News posts are organization-wide, not branch-specific
      published_at: new Date().toISOString(),
    };

    console.log("News data to insert:", { ...newsData, content: "[content hidden]" });

    const { data, error } = await supabase.from("news_posts").insert(newsData).select().single();

    if (error) {
      console.error("Supabase error creating news post:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      throw error;
    }

    console.log("Successfully created news post:", data?.id);

    revalidatePath("/dashboard/start");
    revalidatePath("/dashboard/announcements");

    return { data, error: null };
  } catch (error) {
    console.error("Error in createNewsPost:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to create news post",
    };
  }
}

export async function updateAnnouncementPost(newsId: string, formData: AnnouncementFormData) {
  try {
    const supabase = await createClient();
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      throw new Error("No active organization");
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const updateData = {
      title: formData.title,
      content: JSON.parse(formData.content), // Parse the JSON string from Lexical
      excerpt: formData.excerpt || null,
      priority: formData.priority,
      badges: formData.badges,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("news_posts")
      .update(updateData)
      .eq("id", newsId)
      .eq("author_id", user.id) // Ensure user can only update their own posts
      .select()
      .single();

    if (error) {
      console.error("Error updating news post:", error);
      throw error;
    }

    revalidatePath("/dashboard/start");
    revalidatePath("/dashboard/announcements");

    return { data, error: null };
  } catch (error) {
    console.error("Error in updateNewsPost:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to update news post",
    };
  }
}

export async function deleteAnnouncementPost(newsId: string) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      throw new Error("User not authenticated");
    }

    const { error } = await supabase
      .from("news_posts")
      .delete()
      .eq("id", newsId)
      .eq("author_id", user.id); // Ensure user can only delete their own posts

    if (error) {
      console.error("Error deleting news post:", error);
      throw error;
    }

    revalidatePath("/dashboard/start");
    revalidatePath("/dashboard/announcements");

    return { error: null };
  } catch (error) {
    console.error("Error in deleteNewsPost:", error);
    return {
      error: error instanceof Error ? error.message : "Failed to delete news post",
    };
  }
}

export async function getAnnouncementPost(newsId: string) {
  try {
    const supabase = await createClient();
    const appContext = await loadAppContextServer();

    if (!appContext?.activeOrgId) {
      throw new Error("No active organization");
    }

    const { data, error } = await supabase
      .from("news_posts")
      .select("*")
      .eq("id", newsId)
      .eq("organization_id", appContext.activeOrgId)
      .single();

    if (error) {
      console.error("Error fetching news post:", error);
      throw error;
    }

    // Get author information if available
    let author_name = "Unknown";
    let author_email = null;

    if (data.author_id) {
      try {
        const { data: userData } = await supabase
          .from("users")
          .select("email, first_name, last_name")
          .eq("id", data.author_id)
          .single();

        if (userData) {
          author_name =
            `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
            userData.email ||
            "Unknown";
          author_email = userData.email;
        }
      } catch (error) {
        console.warn("Could not fetch author info for post:", data.id, error);
      }
    }

    // Transform the data to include author information
    const transformedData = {
      ...data,
      author_name,
      author_email,
      author_avatar: null,
    };

    return { data: transformedData, error: null };
  } catch (error) {
    console.error("Error in getNewsPost:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to fetch news post",
    };
  }
}
