import { useQuery } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { fetchOrgMembersSummary } from "@/lib/queries/organization/org-members-summary";
import type { OrgMembersSummary } from "@/lib/queries/organization/org-members-summary";
import type { HookResult } from "@/lib/queries/types";

export const orgMembersSummaryQueryKey = (orgId: string) => ["org-members-summary", orgId] as const;

/**
 * Returns the active member count for the given org.
 *
 * Returns HookResult<OrgMembersSummary>:
 *   "loading"   — query in flight or orgId not yet available
 *   "data"      — { totalMembers: number }
 *   "forbidden" — RLS denied (classified in query fn)
 *   "error"     — unexpected failure
 *
 * Note: this query does not return "empty" — a zero count is valid data,
 * not an absence of rows. kind="data" with totalMembers=0 is the correct
 * representation of an org with no active members.
 */
export function useOrgMembersSummary(orgId: string | null): HookResult<OrgMembersSummary> {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: orgId ? orgMembersSummaryQueryKey(orgId) : (["org-members-summary", null] as const),
    queryFn: () => fetchOrgMembersSummary(mobileSupabase, orgId!),
    enabled: orgId !== null,
    staleTime: 2 * 60 * 1000, // 2 min: member counts change more often than profile
  });

  if (!orgId || isLoading) return { kind: "loading" };

  if (isError) {
    const message = error instanceof Error ? error.message : "Failed to load members";
    return { kind: "error", message };
  }

  return data ?? { kind: "loading" };
}
