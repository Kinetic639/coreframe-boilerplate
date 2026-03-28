import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

import { classifyPostgrestError } from "@/lib/queries/types";
import type { QueryResult } from "@/lib/queries/types";

// ─── Domain type ──────────────────────────────────────────────────────────────

export interface OrgMembersSummary {
  totalMembers: number;
}

// ─── Query function ───────────────────────────────────────────────────────────

/**
 * Returns a count of active, non-deleted organization members.
 *
 * Uses PostgREST head=true count to avoid fetching rows.
 * Filters: organization_id (context), status='active', deleted_at IS NULL.
 *
 * Query boundary rule:
 * - organization_id is a context filter, not an auth guard.
 * - status and deleted_at are business filters that define "active member".
 * - No user_id filter — RLS enforces what the caller may read.
 * - No branch logic — member count is org-level.
 */
export async function fetchOrgMembersSummary(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<QueryResult<OrgMembersSummary>> {
  const { count, error, status } = await supabase
    .from("organization_members")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (error) {
    return classifyPostgrestError(status, error.code, error.message);
  }

  // count is null only if the query errors — which is handled above.
  // A successful count of 0 is valid (org exists but has no active members).
  return { kind: "data", data: { totalMembers: count ?? 0 } };
}
