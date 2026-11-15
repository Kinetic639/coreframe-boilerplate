import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

// Saved views of the data table lists: a list's address (its search,
// filters, sort and rows per page) under a name, the person's own or shared
// in the organization. RLS decides who sees and removes what.

export interface ListSavedView {
  id: string;
  name: string;
  /** The list's address query, `?status=a,b&sort=name`. */
  query: string;
  is_shared: boolean;
  user_id: string;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

const COLUMNS = "id, name, query, is_shared, user_id";

function message(error: { message?: string; code?: string }) {
  if (error.code === "23505") return "duplicate_name";
  return error.message ?? "Unknown error";
}

export class ListSavedViewsService {
  /** The views of a list the person sees: their own and the shared ones. */
  static async list(
    supabase: SupabaseClient,
    orgId: string,
    listKey: string
  ): Promise<Result<ListSavedView[]>> {
    const { data, error } = await supabase
      .from("list_saved_views")
      .select(COLUMNS)
      .eq("organization_id", orgId)
      .eq("list_key", listKey)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(200);
    if (error) return { success: false, error: message(error) };
    return { success: true, data: (data ?? []) as ListSavedView[] };
  }

  static async save(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: { listKey: string; name: string; query: string; isShared: boolean }
  ): Promise<Result<ListSavedView>> {
    const { data, error } = await supabase
      .from("list_saved_views")
      .insert({
        organization_id: orgId,
        user_id: userId,
        list_key: input.listKey,
        name: input.name.trim(),
        query: input.query,
        is_shared: input.isShared,
      })
      .select(COLUMNS)
      .single();
    if (error) return { success: false, error: message(error) };
    return { success: true, data: data as ListSavedView };
  }

  /** Removes a view (soft): one's own, or a shared one with org.update. */
  static async remove(
    supabase: SupabaseClient,
    orgId: string,
    viewId: string
  ): Promise<Result<{ id: string }>> {
    const { data, error } = await supabase
      .from("list_saved_views")
      .update({ deleted_at: new Date().toISOString() })
      .eq("organization_id", orgId)
      .eq("id", viewId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) return { success: false, error: message(error) };
    if (!data) return { success: false, error: "not_found" };
    return { success: true, data: data as { id: string } };
  }
}
