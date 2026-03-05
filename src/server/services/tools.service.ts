import { SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// State scoping note
//
// user_enabled_tools stores ONLY user_id — no org_id column.
// Tool state (enabled / pinned / settings) is USER-GLOBAL: consistent across
// organisation switches and branch switches for the same user.
// Permission gates (tools.read / tools.manage) are still org-scoped and are
// enforced in server actions via permissionSnapshot — NOT in this service.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface ToolCatalogItem {
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  icon_key: string | null;
  is_active: boolean;
  sort_order: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserEnabledTool {
  id: string;
  user_id: string;
  tool_slug: string;
  enabled: boolean;
  pinned: boolean;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface UserEnabledToolWithCatalog extends UserEnabledTool {
  tool: ToolCatalogItem;
}

/**
 * Minimal projection returned by listPinnedToolsForSidebar.
 * Only the fields required to build sidebar navigation items are fetched.
 */
export interface PinnedToolSidebarRow {
  tool_slug: string;
  created_at: string;
  /** Resolved from the tools_catalog join; falls back to tool_slug if missing. */
  name: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDbError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || (error.message && error.message.includes("row-level security"))) {
    return "You do not have permission to perform this action.";
  }
  return error.message;
}

// ---------------------------------------------------------------------------
// ToolsCatalogService
// ---------------------------------------------------------------------------

export class ToolsCatalogService {
  /**
   * List all active tools in the catalog, ordered by sort_order.
   * Accessible by all authenticated users (RLS: SELECT true for authenticated).
   */
  static async listCatalog(supabase: SupabaseClient): Promise<ServiceResult<ToolCatalogItem[]>> {
    const { data, error } = await supabase
      .from("tools_catalog")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as ToolCatalogItem[] };
  }

  /**
   * Get a single tool by its slug.
   * Returns null data (not an error) when the slug is not found or tool is inactive.
   */
  static async getToolBySlug(
    supabase: SupabaseClient,
    slug: string
  ): Promise<ServiceResult<ToolCatalogItem | null>> {
    const { data, error } = await supabase
      .from("tools_catalog")
      .select("*")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as ToolCatalogItem | null };
  }
}

// ---------------------------------------------------------------------------
// UserToolsService
// ---------------------------------------------------------------------------

export class UserToolsService {
  /**
   * List tools the current user has enabled (enabled = true only).
   * Used to hydrate the "My Tools" page and catalog "enabled" badges.
   */
  static async listUserEnabledTools(
    supabase: SupabaseClient,
    userId: string
  ): Promise<ServiceResult<UserEnabledTool[]>> {
    const { data, error } = await supabase
      .from("user_enabled_tools")
      .select("*")
      .eq("user_id", userId)
      .eq("enabled", true)
      .order("created_at", { ascending: false });

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as UserEnabledTool[] };
  }

  /**
   * Get a single user-tool record for the given slug.
   * Returns null when the user has not interacted with the tool yet.
   */
  static async getUserToolRecord(
    supabase: SupabaseClient,
    userId: string,
    toolSlug: string
  ): Promise<ServiceResult<UserEnabledTool | null>> {
    const { data, error } = await supabase
      .from("user_enabled_tools")
      .select("*")
      .eq("user_id", userId)
      .eq("tool_slug", toolSlug)
      .maybeSingle();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as UserEnabledTool | null };
  }

  /**
   * List only the tools the user has pinned (regardless of enabled state).
   * Used to populate the sidebar submenu with quick-access pinned tools.
   */
  static async listPinnedTools(
    supabase: SupabaseClient,
    userId: string
  ): Promise<ServiceResult<UserEnabledTool[]>> {
    const { data, error } = await supabase
      .from("user_enabled_tools")
      .select("*")
      .eq("user_id", userId)
      .eq("pinned", true)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as UserEnabledTool[] };
  }

  /**
   * Enable or disable a tool for the given user.
   * Uses upsert: creates a record on first enable, updates on subsequent calls.
   */
  static async setToolEnabled(
    supabase: SupabaseClient,
    userId: string,
    toolSlug: string,
    enabled: boolean
  ): Promise<ServiceResult<UserEnabledTool>> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("user_enabled_tools")
      .upsert(
        {
          user_id: userId,
          tool_slug: toolSlug,
          enabled,
          // Auto-unpin when disabling so the tool is removed from the sidebar
          ...(enabled === false ? { pinned: false } : {}),
          updated_at: now,
        },
        { onConflict: "user_id,tool_slug" }
      )
      .select("*")
      .single();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as UserEnabledTool };
  }

  /**
   * Pin or unpin a tool for the given user.
   * Upserts the record; if the tool was not yet enabled it will be created
   * with enabled=false and pinned=<value>.
   */
  static async setToolPinned(
    supabase: SupabaseClient,
    userId: string,
    toolSlug: string,
    pinned: boolean
  ): Promise<ServiceResult<UserEnabledTool>> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("user_enabled_tools")
      .upsert(
        {
          user_id: userId,
          tool_slug: toolSlug,
          pinned,
          updated_at: now,
        },
        { onConflict: "user_id,tool_slug" }
      )
      .select("*")
      .single();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as UserEnabledTool };
  }

  /**
   * Minimal fetch for building sidebar navigation items.
   *
   * Selects only tool_slug + created_at from user_enabled_tools and joins
   * tools_catalog for the display name — a single DB round-trip instead of two.
   * Used exclusively by the dashboard layout's pinned-tools injection; prefer
   * listPinnedTools for other call-sites that need full row data.
   *
   * State scoping: filters by user_id only (no org_id — tool state is user-global).
   */
  static async listPinnedToolsForSidebar(
    supabase: SupabaseClient,
    userId: string
  ): Promise<ServiceResult<PinnedToolSidebarRow[]>> {
    const { data, error } = await supabase
      .from("user_enabled_tools")
      .select("tool_slug, created_at, tools_catalog(name)")
      .eq("user_id", userId)
      .eq("pinned", true)
      .order("created_at", { ascending: true });

    if (error) return { success: false, error: normalizeDbError(error) };

    const rows: PinnedToolSidebarRow[] = (data ?? []).map(
      (row: { tool_slug: string; created_at: string; tools_catalog: { name: string } | null }) => ({
        tool_slug: row.tool_slug,
        created_at: row.created_at,
        name: row.tools_catalog?.name ?? row.tool_slug,
      })
    );

    return { success: true, data: rows };
  }

  /**
   * Persist arbitrary per-tool settings JSON for the given user.
   */
  static async updateToolSettings(
    supabase: SupabaseClient,
    userId: string,
    toolSlug: string,
    settings: Record<string, unknown>
  ): Promise<ServiceResult<UserEnabledTool>> {
    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from("user_enabled_tools")
      .upsert(
        {
          user_id: userId,
          tool_slug: toolSlug,
          settings,
          updated_at: now,
        },
        { onConflict: "user_id,tool_slug" }
      )
      .select("*")
      .single();

    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as UserEnabledTool };
  }
}
