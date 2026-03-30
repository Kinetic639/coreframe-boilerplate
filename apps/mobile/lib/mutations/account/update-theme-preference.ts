import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@repo/supabase/database";

// ─── Mutation function ────────────────────────────────────────────────────────

/**
 * Persists the user's theme preference to user_preferences.dashboard_settings.ui.theme.
 *
 * Uses a client-side merge + UPSERT pattern:
 *   1. currentDashboardSettings is passed in from the query cache (AccountProfile.rawDashboardSettings)
 *      — avoids an extra round-trip to the DB before writing.
 *   2. Merges the new theme into the existing dashboard_settings structure.
 *   3. Upserts the merged object with onConflict: "user_id" — creates the
 *      user_preferences row if it does not exist, updates if it does.
 *
 * App-wide theme enforcement is deferred. This writes the preference only;
 * callers are responsible for updating local UI state independently.
 *
 * Throw-on-failure: throws on DB error. TanStack Query's onError handles it.
 */
export async function updateThemePreference(
  supabase: SupabaseClient<Database>,
  userId: string,
  theme: "light" | "dark" | "system",
  currentDashboardSettings: Record<string, unknown> | null
): Promise<void> {
  const existingUi =
    currentDashboardSettings?.ui != null && typeof currentDashboardSettings.ui === "object"
      ? (currentDashboardSettings.ui as Record<string, unknown>)
      : {};

  const merged: Record<string, unknown> = {
    ...(currentDashboardSettings ?? {}),
    ui: { ...existingUi, theme },
  };

  const { error } = await supabase
    .from("user_preferences")
    .upsert(
      { user_id: userId, dashboard_settings: merged as unknown as Json },
      { onConflict: "user_id" }
    );

  if (error) throw new Error(error.message);
}
