import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  CreateNewsPostInput,
  UpdateNewsPostInput,
  NewsFilters,
} from "@/server/schemas/news.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type NewsPost = Database["public"]["Tables"]["news_posts"]["Row"];

export interface NewsPostWithAuthor extends NewsPost {
  author_name: string;
  author_email: string | null;
  author_avatar: string | null;
}

// ==========================================
// NEWS SERVICE
// ==========================================

export class NewsService {
  /**
   * Get news posts for an organization with author information
   */
  static async getNewsPosts(
    supabase: SupabaseClient<Database>,
    organizationId: string,
    filters: NewsFilters = {}
  ): Promise<NewsPostWithAuthor[]> {
    const { limit = 20, offset = 0, priority, author_id, search } = filters;

    let query = supabase
      .from("news_posts")
      .select("*")
      .eq("organization_id", organizationId)
      .order("published_at", { ascending: false });

    // Apply filters
    if (priority) {
      query = query.eq("priority", priority);
    }

    if (author_id) {
      query = query.eq("author_id", author_id);
    }

    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    // Apply pagination
    if (limit) {
      query = query.limit(limit);
    }

    if (offset) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data: newsPosts, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch news posts: ${error.message}`);
    }

    if (!newsPosts || newsPosts.length === 0) {
      return [];
    }

    // Get all unique author IDs
    const authorIds = [...new Set(newsPosts.map((post) => post.author_id).filter(Boolean))];

    // Fetch all author information in one query
    const authorsMap = new Map();
    if (authorIds.length > 0) {
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
    }

    // Transform the data to include author information
    return newsPosts.map((post) => ({
      ...post,
      author_name: authorsMap.get(post.author_id)?.name || "Unknown",
      author_email: authorsMap.get(post.author_id)?.email || null,
      author_avatar: null,
    }));
  }

  /**
   * Get a single news post by ID with author information
   */
  static async getNewsPost(
    supabase: SupabaseClient<Database>,
    newsId: string,
    organizationId: string
  ): Promise<NewsPostWithAuthor | null> {
    const { data: newsPost, error } = await supabase
      .from("news_posts")
      .select("*")
      .eq("id", newsId)
      .eq("organization_id", organizationId)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch news post: ${error.message}`);
    }

    // Get author information if available
    let author_name = "Unknown";
    let author_email: string | null = null;

    if (newsPost.author_id) {
      const { data: userData } = await supabase
        .from("users")
        .select("email, first_name, last_name")
        .eq("id", newsPost.author_id)
        .single();

      if (userData) {
        author_name =
          `${userData.first_name || ""} ${userData.last_name || ""}`.trim() ||
          userData.email ||
          "Unknown";
        author_email = userData.email;
      }
    }

    return {
      ...newsPost,
      author_name,
      author_email,
      author_avatar: null,
    };
  }

  /**
   * Create a new news post
   */
  static async createNewsPost(
    supabase: SupabaseClient<Database>,
    input: CreateNewsPostInput
  ): Promise<NewsPost> {
    const newsData = {
      title: input.title,
      content: JSON.parse(input.content), // Parse the JSON string from Lexical
      excerpt: input.excerpt || null,
      priority: input.priority,
      badges: input.badges,
      author_id: input.author_id,
      organization_id: input.organization_id,
      branch_id: input.branch_id || null,
      published_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("news_posts")
      .insert(newsData as any)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create news post: ${error.message}`);
    }

    return data;
  }

  /**
   * Update a news post
   */
  static async updateNewsPost(
    supabase: SupabaseClient<Database>,
    newsId: string,
    userId: string,
    input: UpdateNewsPostInput
  ): Promise<NewsPost> {
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (input.title) updateData.title = input.title;
    if (input.content) updateData.content = JSON.parse(input.content);
    if (input.excerpt !== undefined) updateData.excerpt = input.excerpt;
    if (input.priority) updateData.priority = input.priority;
    if (input.badges) updateData.badges = input.badges;

    const { data, error } = await supabase
      .from("news_posts")
      .update(updateData)
      .eq("id", newsId)
      .eq("author_id", userId) // Ensure user can only update their own posts
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update news post: ${error.message}`);
    }

    return data;
  }

  /**
   * Delete a news post
   */
  static async deleteNewsPost(
    supabase: SupabaseClient<Database>,
    newsId: string,
    userId: string
  ): Promise<void> {
    const { error } = await supabase
      .from("news_posts")
      .delete()
      .eq("id", newsId)
      .eq("author_id", userId); // Ensure user can only delete their own posts

    if (error) {
      throw new Error(`Failed to delete news post: ${error.message}`);
    }
  }
}
