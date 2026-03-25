import { useQuery } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { fetchOrgProfile } from "@/lib/queries/organization/org-profile";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";
import type { HookResult } from "@/lib/queries/types";

// ─── Query key ────────────────────────────────────────────────────────────────

/**
 * Stable query key for the org profile query.
 * Keyed by orgId so the cache is invalidated if the active org changes
 * (not expected in current product model, but correct by default).
 */
export const orgProfileQueryKey = (orgId: string) => ["org-profile", orgId] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the organization profile for the given orgId.
 *
 * Returns a HookResult discriminated union:
 *   "loading"   — query in flight (or orgId not yet available)
 *   "data"      — profile row found and normalized
 *   "empty"     — no profile row exists for this org (valid state)
 *   "forbidden" — RLS denied access (classified by fetchOrgProfile, not here)
 *   "error"     — unexpected failure; message is safe to display
 *
 * Screens branch on `result.kind` only. No error-message parsing required.
 *
 * @param orgId  The active organization ID from AppContext. Pass null to
 *               disable the query (hook returns "loading" until orgId is set).
 */
export function useOrgProfileQuery(orgId: string | null): HookResult<OrgProfileData> {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: orgId ? orgProfileQueryKey(orgId) : (["org-profile", null] as const),
    queryFn: () => fetchOrgProfile(mobileSupabase, orgId!),
    enabled: orgId !== null,
    staleTime: 5 * 60 * 1000,
  });

  // No orgId yet, or query is in flight
  if (!orgId || isLoading) return { kind: "loading" };

  // React Query network-level error (not a PostgREST error — those are
  // classified inside fetchOrgProfile and returned as resolved data)
  if (isError) {
    const message = error instanceof Error ? error.message : "Failed to load profile";
    return { kind: "error", message };
  }

  // fetchOrgProfile always returns a QueryResult — propagate it directly.
  // If data is undefined (query disabled / not yet settled), treat as loading.
  return data ?? { kind: "loading" };
}
