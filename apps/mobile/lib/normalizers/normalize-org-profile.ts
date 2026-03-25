import type { Database } from "@repo/supabase/database";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";

type OrgProfileRow = Database["public"]["Tables"]["organization_profiles"]["Row"];

/**
 * The subset of organization_profiles columns fetched by fetchOrgProfile.
 * created_at is intentionally excluded — it is a write-time audit field not
 * needed in the app domain type. Using Pick here ensures the normalizer's
 * parameter type exactly matches what the typed SELECT query returns, so
 * TypeScript will catch any mismatch between query columns and normalizer input.
 */
type SelectedOrgProfileRow = Pick<
  OrgProfileRow,
  | "organization_id"
  | "name"
  | "name_2"
  | "slug"
  | "bio"
  | "website"
  | "logo_url"
  | "theme_color"
  | "font_color"
>;

/**
 * Maps a typed organization_profiles DB row to the app-local OrgProfileData shape.
 *
 * Although the Database type already reflects the live schema, this normalizer
 * provides an explicit contract boundary: DB schema changes will surface as
 * TypeScript errors here before propagating to consumers. It also keeps the
 * pattern consistent with normalize-entitlements.ts and future normalizers.
 *
 * All fields except organization_id are nullable per the live schema.
 * No coercion is performed — the DB guarantees the types via the generated
 * Database type, so validation is structural (type-checked), not runtime-cast.
 */
export function normalizeOrgProfile(row: SelectedOrgProfileRow): OrgProfileData {
  return {
    organization_id: row.organization_id,
    name: row.name ?? null,
    name_2: row.name_2 ?? null,
    slug: row.slug ?? null,
    bio: row.bio ?? null,
    website: row.website ?? null,
    logo_url: row.logo_url ?? null,
    theme_color: row.theme_color ?? null,
    font_color: row.font_color ?? null,
  };
}
