import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { mobileSupabase } from "@/lib/supabase/client";
import { fetchBranches } from "@/lib/queries/branches/branches";
import type { BranchData } from "@/lib/queries/branches/branches";
import { QUERY_KEY_DISABLED } from "@/lib/queries/types";
import type { HookResult } from "@/lib/queries/types";

// ─── Query key ────────────────────────────────────────────────────────────────

/**
 * Stable query key for the branches-by-id query.
 *
 * Accepts a pre-normalized (deduplicated, sorted) ID array so the cache entry
 * is identical regardless of input ordering or duplicate JWT branch roles.
 */
export const branchesQueryKey = (normalizedIds: string[]) => ["branches", normalizedIds] as const;

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Returns branch display data (name, slug) for the given branch ID list.
 *
 * Branch ID normalization — applied before query key and query input:
 *   normalizedIds = [...new Set(branchIds)].sort()
 *
 * Deduplication via Set collapses duplicate UUIDs that may appear when a user
 * holds multiple roles for the same branch. Alphabetical sort makes the cache
 * key stable regardless of JWT role insertion order.
 *
 * Returns HookResult<BranchData[]>:
 *   "loading"   — query in flight, or branchIds is empty (disabled query)
 *   "data"      — branch rows resolved; data may be [] if all branches were
 *                 deleted since the JWT was issued (valid state, not "empty")
 *   "forbidden" — RLS denied access (classified in fetchBranches)
 *   "error"     — unexpected server or network failure
 *
 * Note: kind="empty" is intentionally absent. An empty branch list is valid
 * data, not an absence of a row (contrast with single-row lookups like org profile).
 *
 * @param branchIds  Raw branch UUID list from appState.accessibleBranchIds.
 *                   May contain duplicates or be in any order — normalized internally.
 */
export function useBranchesQuery(branchIds: string[]): HookResult<BranchData[]> {
  // ── Normalize: deduplicate + sort for a stable cache key and query input ──
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const normalizedIds = useMemo(() => [...new Set(branchIds)].sort(), [branchIds.join(",")]);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: branchesQueryKey(normalizedIds.length > 0 ? normalizedIds : [QUERY_KEY_DISABLED]),
    queryFn: () => fetchBranches(mobileSupabase, normalizedIds),
    enabled: normalizedIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 min — branch names are stable within a session
  });

  if (!normalizedIds.length || isLoading) return { kind: "loading" };

  if (isError) {
    const message = error instanceof Error ? error.message : "Failed to load branches";
    return { kind: "error", message };
  }

  // data must be a QueryResult — fetchBranches always returns a settled result.
  // If undefined here, the query-function contract has been violated.
  if (data === undefined) {
    return { kind: "error", message: "Unexpected empty query result" };
  }

  return data;
}
