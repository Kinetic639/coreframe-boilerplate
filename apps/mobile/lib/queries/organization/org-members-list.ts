import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

import { classifyPostgrestError } from "@/lib/queries/types";
import type { QueryResult } from "@/lib/queries/types";
import { normalizeOrgMember } from "@/lib/normalizers/normalize-org-member";
import type { OrgMemberItem, RawOrgMemberRow } from "@/lib/normalizers/normalize-org-member";

export type { OrgMemberItem };

// ─── Query function ───────────────────────────────────────────────────────────

/**
 * Fetches the list of active members for the given org.
 *
 * Filters applied:
 *   - organization_id = orgId        (context scope)
 *   - status = 'active'              (consistent with org-members-summary count)
 *   - deleted_at IS NULL             (soft-delete exclusion)
 *
 * Joined columns from users: email, first_name, last_name, avatar_url.
 * Roles are NOT fetched — role data requires branch-scoped context (Phase 10).
 *
 * Returns:
 *   "data"      — one or more active members found
 *   "empty"     — org has no active members (zero rows; valid state)
 *   "forbidden" — RLS denied access (classified by classifyPostgrestError)
 *   "error"     — unexpected server or network failure
 */
export async function fetchOrgMembersList(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<QueryResult<OrgMemberItem[]>> {
  const { data, error, status } = await supabase
    .from("organization_members")
    .select(
      "user_id, status, joined_at, users!organization_members_user_id_fkey(email, first_name, last_name, avatar_url)"
    )
    .eq("organization_id", orgId)
    .eq("status", "active")
    .is("deleted_at", null)
    .order("joined_at", { ascending: true });

  if (error) return classifyPostgrestError(status, error.code, error.message);

  // The Supabase client infers a complex type for the joined select string.
  // Cast to our explicit RawOrgMemberRow[] which matches the selected columns exactly.
  const items = (data as unknown as RawOrgMemberRow[]).map(normalizeOrgMember);

  if (items.length === 0) return { kind: "empty" };
  return { kind: "data", data: items };
}
