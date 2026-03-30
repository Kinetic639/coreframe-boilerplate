import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

import { classifyPostgrestError } from "@/lib/queries/types";
import type { QueryResult } from "@/lib/queries/types";

// ─── Domain type ──────────────────────────────────────────────────────────────

/**
 * App-local type for the current user's account profile.
 *
 * Aggregates data from two tables:
 *   public.users        → firstName, lastName
 *   user_preferences    → displayName, theme, rawDashboardSettings
 *
 * rawDashboardSettings is carried through so update-theme-preference can do
 * a client-side merge without an extra read. It is not displayed in the UI.
 *
 * All name fields are nullable: users may have no names set yet.
 * theme defaults to "system" when user_preferences has no row or no ui.theme.
 */
export interface AccountProfile {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  theme: "light" | "dark" | "system";
  rawDashboardSettings: Record<string, unknown> | null;
}

// ─── Query function ───────────────────────────────────────────────────────────

/**
 * Fetches the current user's account profile.
 *
 * Runs two queries in parallel:
 *   1. public.users — first_name, last_name (always exists for authenticated users)
 *   2. user_preferences — display_name, dashboard_settings (may not exist)
 *
 * user_preferences absence is not an error: it returns defaults
 * (displayName: null, theme: "system"). Never returns kind="empty" —
 * there is always something to display (email is available from AppContext
 * independently, and public.users always has a row).
 *
 * Returns kind="error" or kind="forbidden" if either query fails with a
 * PostgREST error. The first failing query's classification is returned.
 */
export async function fetchAccountProfile(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<QueryResult<AccountProfile>> {
  const [usersResult, prefsResult] = await Promise.all([
    supabase.from("users").select("first_name, last_name").eq("id", userId).single(),
    supabase
      .from("user_preferences")
      .select("display_name, dashboard_settings")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .maybeSingle(),
  ]);

  if (usersResult.error) {
    return classifyPostgrestError(
      usersResult.status,
      usersResult.error.code,
      usersResult.error.message
    );
  }

  if (prefsResult.error) {
    return classifyPostgrestError(
      prefsResult.status,
      prefsResult.error.code,
      prefsResult.error.message
    );
  }

  // public.users always has a row for authenticated users; guard defensively
  if (!usersResult.data) {
    return { kind: "error", message: "Nie znaleziono danych użytkownika" };
  }

  // user_preferences may be absent — use defaults
  const prefs = prefsResult.data;
  const rawDashboardSettings =
    prefs?.dashboard_settings != null
      ? (prefs.dashboard_settings as Record<string, unknown>)
      : null;

  const rawTheme = (rawDashboardSettings?.ui as Record<string, unknown> | undefined)?.theme;
  const theme: AccountProfile["theme"] =
    rawTheme === "light" || rawTheme === "dark" || rawTheme === "system" ? rawTheme : "system";

  return {
    kind: "data",
    data: {
      firstName: usersResult.data.first_name ?? null,
      lastName: usersResult.data.last_name ?? null,
      displayName: prefs?.display_name ?? null,
      theme,
      rawDashboardSettings,
    },
  };
}
