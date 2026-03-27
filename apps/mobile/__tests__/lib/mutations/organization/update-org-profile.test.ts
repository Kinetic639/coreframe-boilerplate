import { describe, it, expect } from "vitest";
import { updateOrgProfile } from "@/lib/mutations/organization/update-org-profile";
import type { UpdateOrgProfileInput } from "@/lib/mutations/organization/update-org-profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

// ─── Mock builder ─────────────────────────────────────────────────────────────

type ProfileRow = {
  organization_id: string;
  name: string | null;
  name_2: string | null;
  slug: string | null;
  bio: string | null;
  website: string | null;
  logo_url: string | null;
  theme_color: string | null;
  font_color: string | null;
};

/**
 * Builds a minimal chainable Supabase mock for the update chain:
 *   .from("organization_profiles").update(input).eq(...).select(...).maybeSingle()
 */
function makeMockClient(resolution: {
  data: ProfileRow | null;
  error: { message: string } | null;
}): SupabaseClient<Database> {
  const builder: Record<string, unknown> = {
    update() {
      return this;
    },
    eq() {
      return this;
    },
    select() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve(resolution);
    },
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

const VALID_ROW: ProfileRow = {
  organization_id: "org-1",
  name: "Acme Corp",
  name_2: "Branch A",
  slug: "acme",
  bio: "Short bio",
  website: "https://acme.com",
  logo_url: null,
  theme_color: null,
  font_color: null,
};

const VALID_INPUT: UpdateOrgProfileInput = {
  name: "Acme Corp",
  name_2: "Branch A",
  bio: "Short bio",
  website: "https://acme.com",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("updateOrgProfile", () => {
  // ── 1. Success ───────────────────────────────────────────────────────────────
  it("returns normalized OrgProfileData on success", async () => {
    const client = makeMockClient({ data: VALID_ROW, error: null });
    const result = await updateOrgProfile(client, "org-1", VALID_INPUT);

    expect(result.organization_id).toBe("org-1");
    expect(result.name).toBe("Acme Corp");
    expect(result.name_2).toBe("Branch A");
    expect(result.website).toBe("https://acme.com");
  });

  // ── 2. Validation: name too long ─────────────────────────────────────────────
  it("throws when name exceeds 200 characters", async () => {
    const client = makeMockClient({ data: null, error: null });
    await expect(updateOrgProfile(client, "org-1", { name: "a".repeat(201) })).rejects.toThrow(
      "200"
    );
  });

  // ── 3. Validation: name_2 too long ───────────────────────────────────────────
  it("throws when name_2 exceeds 200 characters", async () => {
    const client = makeMockClient({ data: null, error: null });
    await expect(updateOrgProfile(client, "org-1", { name_2: "b".repeat(201) })).rejects.toThrow(
      "200"
    );
  });

  // ── 4. Validation: bio too long ──────────────────────────────────────────────
  it("throws when bio exceeds 500 characters", async () => {
    const client = makeMockClient({ data: null, error: null });
    await expect(updateOrgProfile(client, "org-1", { bio: "c".repeat(501) })).rejects.toThrow(
      "500"
    );
  });

  // ── 5. Validation: invalid website URL ──────────────────────────────────────
  it("throws when website is not a valid http/https URL", async () => {
    const client = makeMockClient({ data: null, error: null });
    await expect(updateOrgProfile(client, "org-1", { website: "not-a-url" })).rejects.toThrow(
      "URL"
    );
  });

  // ── 5b. Validation: http:// URL is accepted ──────────────────────────────────
  it("accepts a valid http:// website URL", async () => {
    const client = makeMockClient({
      data: { ...VALID_ROW, website: "http://example.com" },
      error: null,
    });
    const result = await updateOrgProfile(client, "org-1", {
      ...VALID_INPUT,
      website: "http://example.com",
    });
    expect(result.website).toBe("http://example.com");
  });

  // ── 6. DB error → throws ─────────────────────────────────────────────────────
  it("throws the Supabase error message on DB error", async () => {
    const client = makeMockClient({ data: null, error: { message: "connection refused" } });
    await expect(updateOrgProfile(client, "org-1", VALID_INPUT)).rejects.toThrow(
      "connection refused"
    );
  });

  // ── 7. Zero-row match → throws ───────────────────────────────────────────────
  it("throws when data is null (RLS blocked or row not found)", async () => {
    const client = makeMockClient({ data: null, error: null });
    await expect(updateOrgProfile(client, "org-1", VALID_INPUT)).rejects.toThrow(
      /profilu|uprawnień/
    );
  });
});
