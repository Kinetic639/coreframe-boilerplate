import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

import { classifyPostgrestError } from "@/lib/queries/types";
import type { QueryResult } from "@/lib/queries/types";

// ─── Domain type ──────────────────────────────────────────────────────────────

/**
 * App-local type for branch data.
 *
 * Defined here rather than in @repo/contracts because branch display is
 * currently consumed only by apps/mobile. Promote to @repo/contracts if
 * apps/web needs to share this shape.
 *
 * All fields except `id` and `organization_id` may be null or absent
 * depending on how the branch was created.
 */
export interface BranchData {
  id: string;
  name: string;
  organization_id: string;
  slug: string | null;
  created_at: string;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

type RawBranchRow = {
  id: string;
  name: string;
  organization_id: string;
  slug: string | null;
  created_at: string | null;
};

function normalizeBranch(raw: RawBranchRow): BranchData {
  return {
    id: raw.id,
    name: raw.name,
    organization_id: raw.organization_id,
    slug: raw.slug ?? null,
    created_at: raw.created_at ?? "",
  };
}

// ─── Query function ───────────────────────────────────────────────────────────

/**
 * Fetches branch display data for a pre-normalized set of branch IDs.
 *
 * Design rules:
 * - `branchIds` MUST be non-empty (callers guard with `enabled: ids.length > 0`).
 * - `branchIds` MUST be deduplicated and sorted before calling (see useBranchesQuery).
 * - An empty result set (`rows.length === 0`) is valid data — a branch may have
 *   been deleted since the JWT was issued. Returns kind="data" with data=[].
 *   This is semantically distinct from kind="empty" (which signals a missing
 *   single-row lookup), so this function never returns kind="empty".
 * - PostgREST/RLS errors are classified here; hooks and screens branch on kind only.
 *
 * @param supabase   Authenticated Supabase client
 * @param branchIds  Pre-normalized (deduped, sorted) branch UUID list — non-empty
 */
export async function fetchBranches(
  supabase: SupabaseClient<Database>,
  branchIds: string[]
): Promise<QueryResult<BranchData[]>> {
  const { data, error, status } = await supabase
    .from("branches")
    .select("id, name, organization_id, slug, created_at")
    .in("id", branchIds)
    .is("deleted_at", null);

  if (error) {
    return classifyPostgrestError(status, error.code, error.message);
  }

  return { kind: "data", data: (data ?? []).map(normalizeBranch) };
}
