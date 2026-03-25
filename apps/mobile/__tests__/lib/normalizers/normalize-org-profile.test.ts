import { describe, it, expect } from "vitest";
import { normalizeOrgProfile } from "@/lib/normalizers/normalize-org-profile";
import type { Database } from "@repo/supabase/database";

type OrgProfileRow = Database["public"]["Tables"]["organization_profiles"]["Row"];
// Mirror the subset selected by fetchOrgProfile (created_at excluded intentionally)
type SelectedRow = Pick<
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

const FULL_ROW: SelectedRow = {
  organization_id: "org-1",
  name: "Acme Corp",
  name_2: "Acme",
  slug: "acme-corp",
  bio: "We make everything",
  website: "https://acme.example.com",
  logo_url: "https://cdn.example.com/logo.png",
  theme_color: "#ff0000",
  font_color: "#ffffff",
};

describe("normalizeOrgProfile", () => {
  // ── 1. Well-formed row ────────────────────────────────────────────────────
  it("maps a fully-populated row to OrgProfileData", () => {
    const result = normalizeOrgProfile(FULL_ROW);

    expect(result).toEqual({
      organization_id: "org-1",
      name: "Acme Corp",
      name_2: "Acme",
      slug: "acme-corp",
      bio: "We make everything",
      website: "https://acme.example.com",
      logo_url: "https://cdn.example.com/logo.png",
      theme_color: "#ff0000",
      font_color: "#ffffff",
    });
  });

  // ── 2. created_at is not included in the output ───────────────────────────
  it("does not include created_at in OrgProfileData", () => {
    const result = normalizeOrgProfile(FULL_ROW);
    expect(result).not.toHaveProperty("created_at");
  });

  // ── 3. All nullable fields pass through as null ───────────────────────────
  it("maps all null display fields to null", () => {
    const row: SelectedRow = {
      organization_id: "org-2",
      name: null,
      name_2: null,
      slug: null,
      bio: null,
      website: null,
      logo_url: null,
      theme_color: null,
      font_color: null,
    };

    const result = normalizeOrgProfile(row);

    expect(result).toEqual({
      organization_id: "org-2",
      name: null,
      name_2: null,
      slug: null,
      bio: null,
      website: null,
      logo_url: null,
      theme_color: null,
      font_color: null,
    });
  });

  // ── 4. organization_id is always preserved ────────────────────────────────
  it("preserves organization_id from the row", () => {
    const result = normalizeOrgProfile({ ...FULL_ROW, organization_id: "org-xyz" });
    expect(result.organization_id).toBe("org-xyz");
  });

  // ── 5. Partial row (only required field) ─────────────────────────────────
  it("handles a row with only organization_id set", () => {
    const minimal: SelectedRow = {
      organization_id: "org-min",
      name: null,
      name_2: null,
      slug: null,
      bio: null,
      website: null,
      logo_url: null,
      theme_color: null,
      font_color: null,
    };

    const result = normalizeOrgProfile(minimal);
    expect(result.organization_id).toBe("org-min");
    expect(result.name).toBeNull();
    expect(result.slug).toBeNull();
  });
});
