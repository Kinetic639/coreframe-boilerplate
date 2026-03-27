import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

import { normalizeOrgProfile } from "@/lib/normalizers/normalize-org-profile";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";

// ─── Input type ───────────────────────────────────────────────────────────────

/**
 * Fields the user can edit in this slice.
 * Slug, logo_url, theme_color and font_color are intentionally excluded:
 * - slug requires a dual-write to organizations.slug (separate operation)
 * - logo_url requires a file-upload flow (deferred)
 * - theme_color / font_color require a color-picker component (deferred)
 */
export interface UpdateOrgProfileInput {
  name?: string | null;
  name_2?: string | null;
  bio?: string | null;
  website?: string | null;
}

// ─── Validation ───────────────────────────────────────────────────────────────

const URL_PATTERN = /^https?:\/\/.+/i;

/**
 * Validates the mutation input against the same rules enforced by the web
 * updateProfileSchema. Returns an error string on the first failing rule,
 * or null when input is valid.
 *
 * Rules mirrored from web:
 *   name     – max 200 chars when non-null/non-empty
 *   name_2   – max 200 chars when non-null/non-empty
 *   bio      – max 500 chars when non-null/non-empty
 *   website  – must be a valid http(s) URL when non-null/non-empty
 *
 * Rules deliberately excluded from this slice:
 *   slug     – dual-write semantics; deferred
 *   theme_color / font_color – need color-picker; deferred
 *   logo_url – file-upload; deferred
 */
function validateOrgProfileInput(input: UpdateOrgProfileInput): string | null {
  if (input.name != null && input.name.length > 200) {
    return "Nazwa nie może przekraczać 200 znaków";
  }
  if (input.name_2 != null && input.name_2.length > 200) {
    return "Nazwa dodatkowa nie może przekraczać 200 znaków";
  }
  if (input.bio != null && input.bio.length > 500) {
    return "Opis nie może przekraczać 500 znaków";
  }
  if (input.website != null && input.website !== "" && !URL_PATTERN.test(input.website)) {
    return "Adres strony musi być poprawnym adresem URL (https://...)";
  }
  return null;
}

// ─── Mutation function ────────────────────────────────────────────────────────

/**
 * Updates the organization profile for the given org.
 *
 * Contract:
 * - Returns normalized OrgProfileData on success.
 * - Throws an Error on any failure (validation, DB error, zero-row match).
 *
 * Throw-on-failure is intentional: it integrates correctly with TanStack
 * Query's useMutation contract, where onSuccess fires only when mutationFn
 * resolves, and onError fires when it throws. Returning a { success: false }
 * object would cause onSuccess — and therefore invalidateQueries — to run
 * on logical failure, which is incorrect.
 *
 * Authorization:
 * - Client-side: caller must check checkPermission(permissions, ORG_UPDATE)
 *   before rendering the edit affordance (UX gate).
 * - DB layer: RLS policy org_update_permission_can_update_profile enforces
 *   has_permission(organization_id, 'org.update') independently (security gate).
 *   A zero-row result from .update() means RLS blocked the write.
 */
export async function updateOrgProfile(
  supabase: SupabaseClient<Database>,
  orgId: string,
  input: UpdateOrgProfileInput
): Promise<OrgProfileData> {
  const validationError = validateOrgProfileInput(input);
  if (validationError) throw new Error(validationError);

  const { data, error } = await supabase
    .from("organization_profiles")
    .update(input)
    .eq("organization_id", orgId)
    .select("organization_id, name, name_2, slug, bio, website, logo_url, theme_color, font_color")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nie znaleziono profilu lub brak uprawnień do edycji");

  return normalizeOrgProfile(data);
}
