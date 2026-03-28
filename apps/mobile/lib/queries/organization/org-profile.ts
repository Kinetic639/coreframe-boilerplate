import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

import { normalizeOrgProfile } from "@/lib/normalizers/normalize-org-profile";
import { classifyPostgrestError } from "@/lib/queries/types";
import type { QueryResult } from "@/lib/queries/types";

// ─── Domain type ──────────────────────────────────────────────────────────────

/**
 * App-local type for organization profile data.
 *
 * Defined here rather than in @repo/contracts because org profile is currently
 * consumed only by apps/mobile. If apps/web needs to share this shape in future,
 * promote to @repo/contracts at that point.
 *
 * All display fields are nullable: a profile row may exist with only some fields
 * filled. Consumers must handle null for every field except organization_id.
 */
export interface OrgProfileData {
  organization_id: string;
  name: string | null;
  name_2: string | null;
  slug: string | null;
  bio: string | null;
  website: string | null;
  logo_url: string | null;
  theme_color: string | null;
  font_color: string | null;
}

// ─── Query function ───────────────────────────────────────────────────────────

/**
 * Fetches the organization profile for the given org.
 *
 * Returns a QueryResult discriminated union — hooks and UI branch on `kind`.
 * PostgREST/RLS errors are classified here; no error-message parsing is needed
 * at the hook or screen layer.
 *
 * Query boundary rule:
 * - `organization_id` filter is a context filter (scope), NOT an auth guard.
 *   RLS enforces whether the authenticated user can read this org's profile.
 *   The client filter simply tells the DB which org row is wanted.
 * - Do NOT add user_id filters or role checks here; those belong in RLS.
 */
export async function fetchOrgProfile(
  supabase: SupabaseClient<Database>,
  orgId: string
): Promise<QueryResult<OrgProfileData>> {
  const { data, error, status } = await supabase
    .from("organization_profiles")
    .select("organization_id, name, name_2, slug, bio, website, logo_url, theme_color, font_color")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error) {
    return classifyPostgrestError(status, error.code, error.message);
  }

  if (data === null) return { kind: "empty" };

  return { kind: "data", data: normalizeOrgProfile(data) };
}
