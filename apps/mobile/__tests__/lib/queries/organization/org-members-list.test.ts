import { describe, it, expect } from "vitest";
import { fetchOrgMembersList } from "@/lib/queries/organization/org-members-list";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

// ─── Mock builder ─────────────────────────────────────────────────────────────

type MockRow = {
  user_id: string;
  status: string;
  joined_at: string | null;
  users: {
    email: string;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

function makeMockClient(resolution: {
  data: MockRow[] | null;
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
    is() {
      return this;
    },
    order() {
      return Promise.resolve(resolution);
    },
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const RAW_MEMBER_ROWS: MockRow[] = [
  {
    user_id: "user-1",
    status: "active",
    joined_at: "2026-01-01T00:00:00Z",
    users: {
      email: "alice@example.com",
      first_name: "Alice",
      last_name: "Smith",
      avatar_url: null,
    },
  },
  {
    user_id: "user-2",
    status: "active",
    joined_at: "2026-01-02T00:00:00Z",
    users: {
      email: "bob@example.com",
      first_name: "Bob",
      last_name: null,
      avatar_url: "https://example.com/bob.png",
    },
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fetchOrgMembersList", () => {
  // ── 1. Returns kind=data with normalized members on success ───────────────
  it("returns kind=data with normalized OrgMemberItem array on success", async () => {
    const client = makeMockClient({ data: RAW_MEMBER_ROWS, error: null, status: 200 });
    const result = await fetchOrgMembersList(client, "org-1");

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data).toHaveLength(2);
      expect(result.data).toMatchObject([
        {
          userId: "user-1",
          email: "alice@example.com",
          firstName: "Alice",
          lastName: "Smith",
          joinedAt: "2026-01-01T00:00:00Z",
        },
        {
          userId: "user-2",
          avatarUrl: "https://example.com/bob.png",
        },
      ]);
    }
  });

  // ── 2. Returns kind=empty when no active members exist ────────────────────
  it("returns kind=empty when no rows are returned", async () => {
    const client = makeMockClient({ data: [], error: null, status: 200 });
    const result = await fetchOrgMembersList(client, "org-1");

    expect(result.kind).toBe("empty");
  });

  // ── 3. Returns kind=forbidden on HTTP 403 ────────────────────────────────
  it("returns kind=forbidden on HTTP 403", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
      status: 403,
    });
    const result = await fetchOrgMembersList(client, "org-1");

    expect(result.kind).toBe("forbidden");
  });

  // ── 4. Returns kind=forbidden on SQLSTATE 42501 (non-403 HTTP) ───────────
  it("returns kind=forbidden on SQLSTATE 42501 regardless of HTTP status", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "42501", message: "row-level security" },
      status: 400,
    });
    const result = await fetchOrgMembersList(client, "org-1");

    expect(result.kind).toBe("forbidden");
  });

  // ── 5. Returns kind=error on server error ────────────────────────────────
  it("returns kind=error on generic server error", async () => {
    const client = makeMockClient({
      data: null,
      error: { code: "500", message: "Internal server error" },
      status: 500,
    });
    const result = await fetchOrgMembersList(client, "org-1");

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("Internal server error");
    }
  });

  // ── 6. Handles null users join gracefully (orphaned member row) ───────────
  it("normalizes a member row whose users join is null (email falls back to empty string)", async () => {
    const orphanedRow: MockRow = {
      user_id: "user-orphan",
      status: "active",
      joined_at: null,
      users: null,
    };
    const client = makeMockClient({ data: [orphanedRow], error: null, status: 200 });
    const result = await fetchOrgMembersList(client, "org-1");

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data).toMatchObject([
        { email: "", firstName: null, lastName: null, avatarUrl: null },
      ]);
    }
  });
});
