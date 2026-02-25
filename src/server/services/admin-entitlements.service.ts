import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminEntitlements } from "@/lib/types/admin-entitlements";

/**
 * AdminEntitlementsService
 *
 * Loads admin entitlements from the `admin_entitlements` table.
 * The RLS policy (`admin_entitlements_select_own`) ensures users can only
 * read their own row. No service role required.
 */
export class AdminEntitlementsService {
  /**
   * Load admin entitlements for the authenticated user.
   * Returns null if no row exists (meaning the user is not an admin).
   */
  static async loadAdminEntitlements(
    supabase: SupabaseClient,
    userId: string
  ): Promise<AdminEntitlements | null> {
    const { data, error } = await supabase
      .from("admin_entitlements")
      .select("user_id, enabled, updated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[AdminEntitlementsService] Failed to load entitlements:", error);
      }
      return null;
    }

    return data ?? null;
  }
}
