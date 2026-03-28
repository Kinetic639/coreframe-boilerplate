import { describe, it, expect } from "vitest";
import { fetchOrgProfile } from "@/lib/queries/organization/org-profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

// ─── Mock builder ─────────────────────────────────────────────────────────────

type OrgProfileRow = Database["public"]["Tables"]["organization_profiles"]["Row"];
type ProfileRow = Pick<
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
  | "created_at"
>;

/**
 * Minimal chainable mock for the PostgREST query builder.
 * Every method returns `this` so the chain `.select().eq().maybeSingle()`
 * resolves to whatever `resolution` was provided.
 */
function makeMockClient(resolution: {
  data: ProfileRow | null;
  error: { code?: string; message: string } | null;
  status: number;
}): SupabaseClient<Database> {
  const builder: Record<string, unknown> = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve(resolution);
    },
  };
  // Proxy: `.from("organization_profiles")` returns the builder
  return {
    from: () => builder,
  } as unknown as SupabaseClient<Database>;
}

const VALID_ROW: ProfileRow = {
  organization_id: "org-1",
  name: "Acme Corp",
  name_2: null,
  slug: "acme",
  bio: null,
  website: null,
  logo_url: null,
  theme_color: null,
  font_color: null,
  created_at: "2026-01-01T00:00:00Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fetchOrgProfile", () => {
  // ── 1. Success: valid row ─────────────────────────────────────────────────
  it("returns kind=data with normalized profile when row exists", async () => {
    const client = makeMockClient({ data: VALID_ROW, error: null, status: 200 });
    const result = await fetchOrgProfile(client, "org-1");

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data.organization_id).toBe("org-1");
      expect(result.data.name).toBe("Acme Corp");
      expect(result.data.slug).toBe("acme");
    }
  });

  // ── 2. Empty: maybeSingle returns null ────────────────────────────────────
  it("returns kind=empty when no profile row exists", async () => {
    const client = makeMockClient({ data: null, error: null, status: 200 });
    const result = await fetchOrgProfile(client, "org-1");

    expect(result.kind).toBe("empty");
  });

  // ── 3. Forbidden: HTTP 403 ────────────────────────────────────────────────
  it("returns kind=forbidden on HTTP 403", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
      status: 403,
    });
    const result = await fetchOrgProfile(client, "org-1");

    expect(result.kind).toBe("forbidden");
  });

  // ── 4. Forbidden: PostgreSQL SQLSTATE 42501 without 403 ──────────────────
  it("returns kind=forbidden when SQLSTATE is 42501 (non-403 status)", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "42501", message: "row-level security" },
      status: 400,
    });
    const result = await fetchOrgProfile(client, "org-1");

    expect(result.kind).toBe("forbidden");
  });

  // ── 5. Generic error ──────────────────────────────────────────────────────
  it("returns kind=error for unexpected server errors", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "500", message: "Internal server error" },
      status: 500,
    });
    const result = await fetchOrgProfile(client, "org-1");

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("Internal server error");
    }
  });

  // ── 6. Error message passthrough ─────────────────────────────────────────
  it("passes the error message through on kind=error", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "PGRST301", message: "JWT expired" },
      status: 401,
    });
    const result = await fetchOrgProfile(client, "org-1");

    // 401 is not explicitly classified as forbidden — it maps to error
    // (forbidden covers 403 + 42501 only; 401 is an auth issue, not an RLS issue)
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("JWT expired");
    }
  });

  // ── 7. Normalized output excludes created_at ─────────────────────────────
  it("does not include created_at in the returned data", async () => {
    const client = makeMockClient({ data: VALID_ROW, error: null, status: 200 });
    const result = await fetchOrgProfile(client, "org-1");

    if (result.kind === "data") {
      expect(result.data).not.toHaveProperty("created_at");
    }
  });
});
