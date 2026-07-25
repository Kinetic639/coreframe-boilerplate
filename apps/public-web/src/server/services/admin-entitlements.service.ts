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
      // Always log — this is an infrastructure failure, not a user data leak.
      // Silent failures here mean admins can't diagnose why the admin panel is
      // inaccessible in production (G8/G10 audit finding).
      console.error("[AdminEntitlementsService] Failed to load entitlements:", error);
      return null;
    }

    return data ?? null;
  }
}
