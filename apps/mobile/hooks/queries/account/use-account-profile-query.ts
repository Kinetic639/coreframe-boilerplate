import { useQuery } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { fetchAccountProfile } from "@/lib/queries/account/account-profile";
import type { AccountProfile } from "@/lib/queries/account/account-profile";
import { QUERY_KEY_DISABLED } from "@/lib/queries/types";
import type { HookResult } from "@/lib/queries/types";

// ─── Query key ────────────────────────────────────────────────────────────────

/**
 * Stable query key for the account profile query.
 * Keyed by userId so the cache is invalidated if the session changes.
 */
export const accountProfileQueryKey = (userId: string) => ["account-profile", userId] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the current user's account profile.
 *
 * Returns a HookResult discriminated union:
 *   "loading"   — query in flight (or userId not yet available)
 *   "data"      — profile loaded; names/theme available (with defaults if prefs row absent)
 *   "error"     — unexpected DB or network failure
 *   "forbidden" — RLS denied access (not an expected state for own account)
 *   "empty"     — never returned by fetchAccountProfile
 *
 * Screens branch on result.kind only via QueryStateRenderer.
 *
 * @param userId  The current user ID from AppContext. Pass null to disable.
 */
export function useAccountProfileQuery(userId: string | null): HookResult<AccountProfile> {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: accountProfileQueryKey(userId ?? QUERY_KEY_DISABLED),
    queryFn: () => fetchAccountProfile(mobileSupabase, userId!),
    enabled: userId !== null,
    staleTime: 5 * 60 * 1000,
  });

  if (!userId || isLoading) return { kind: "loading" };

  if (isError) {
    const message = error instanceof Error ? error.message : "Błąd ładowania profilu";
    return { kind: "error", message };
  }

  if (data === undefined) {
    return { kind: "error", message: "Unexpected empty query result" };
  }

  return data;
}
