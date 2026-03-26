import { useQuery } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { fetchOrgMembersList } from "@/lib/queries/organization/org-members-list";
import type { OrgMemberItem } from "@/lib/queries/organization/org-members-list";
import { QUERY_KEY_DISABLED } from "@/lib/queries/types";
import type { HookResult } from "@/lib/queries/types";

export type { OrgMemberItem };

// ─── Query key ────────────────────────────────────────────────────────────────

export const orgMembersListQueryKey = (orgId: string) => ["org-members-list", orgId] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns the list of active org members for the given orgId.
 *
 * Returns HookResult<OrgMemberItem[]>:
 *   "loading"   — query in flight or orgId not yet available
 *   "data"      — one or more active members (normalized, no roles)
 *   "empty"     — org has no active members (valid state)
 *   "forbidden" — RLS denied access (classified in query fn)
 *   "error"     — unexpected failure
 *
 * staleTime matches useOrgMembersSummary (2 min) so list and count
 * share the same cache freshness semantics.
 *
 * Roles are NOT included — role data requires branch-scoped context (Phase 10).
 *
 * @param orgId  Active organization ID from AppContext. Pass null to disable.
 */
export function useOrgMembersList(orgId: string | null): HookResult<OrgMemberItem[]> {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: orgMembersListQueryKey(orgId ?? QUERY_KEY_DISABLED),
    queryFn: () => fetchOrgMembersList(mobileSupabase, orgId!),
    enabled: orgId !== null,
    staleTime: 2 * 60 * 1000,
  });

  if (!orgId || isLoading) return { kind: "loading" };

  if (isError) {
    const message = error instanceof Error ? error.message : "Failed to load members";
    return { kind: "error", message };
  }

  // At this point: orgId is set, query is not loading, and no network error.
  // data must be a QueryResult — query functions always return a settled result.
  // If data is still undefined here, the query-function contract has been violated.
  if (data === undefined) {
    return { kind: "error", message: "Unexpected empty query result" };
  }
  return data;
}
