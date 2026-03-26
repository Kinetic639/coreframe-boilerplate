import type { Database } from "@repo/supabase/database";

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberTableRow = Database["public"]["Tables"]["organization_members"]["Row"];
type UserTableRow = Database["public"]["Tables"]["users"]["Row"];

/**
 * Shape of the raw row returned by fetchOrgMembersList.
 *
 * Matches exactly the columns selected:
 *   organization_members: user_id, status, joined_at
 *   users (FK join):      email, first_name, last_name, avatar_url
 *
 * `users` may be null if the organization_members row references a user_id
 * that has no corresponding public.users row (edge case; handled gracefully).
 */
export type RawOrgMemberRow = Pick<MemberTableRow, "user_id" | "status" | "joined_at"> & {
  users: Pick<UserTableRow, "email" | "first_name" | "last_name" | "avatar_url"> | null;
};

/**
 * Normalized read model for a single org member in the list.
 * Roles are excluded — role data requires branch-scoped context (Phase 10).
 */
export interface OrgMemberItem {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  joinedAt: string | null;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

export function normalizeOrgMember(row: RawOrgMemberRow): OrgMemberItem {
  return {
    userId: row.user_id,
    // Fall back to empty string if the joined users row is somehow missing.
    // The RLS-passing query guarantees a valid user_id FK, so this is defensive only.
    email: row.users?.email ?? "",
    firstName: row.users?.first_name ?? null,
    lastName: row.users?.last_name ?? null,
    avatarUrl: row.users?.avatar_url ?? null,
    joinedAt: row.joined_at,
  };
}
