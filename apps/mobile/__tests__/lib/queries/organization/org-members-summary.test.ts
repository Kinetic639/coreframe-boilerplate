import { describe, it, expect } from "vitest";
import { fetchOrgMembersSummary } from "@/lib/queries/organization/org-members-summary";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase/database";

// ─── Mock builder ─────────────────────────────────────────────────────────────

function makeMockClient(resolution: {
  count: number | null;
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
      return Promise.resolve(resolution);
    },
  };
  return { from: () => builder } as unknown as SupabaseClient<Database>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fetchOrgMembersSummary", () => {
  // ── 1. Returns totalMembers count on success ──────────────────────────────
  it("returns kind=data with totalMembers when count succeeds", async () => {
    const client = makeMockClient({ count: 5, error: null, status: 200 });
    const result = await fetchOrgMembersSummary(client, "org-1");

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data.totalMembers).toBe(5);
    }
  });

  // ── 2. Returns totalMembers=0 when count is zero ──────────────────────────
  it("returns kind=data with totalMembers=0 (not empty) for zero members", async () => {
    const client = makeMockClient({ count: 0, error: null, status: 200 });
    const result = await fetchOrgMembersSummary(client, "org-1");

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data.totalMembers).toBe(0);
    }
  });

  // ── 3. Treats null count as 0 ─────────────────────────────────────────────
  it("returns totalMembers=0 when count is null (no rows matched)", async () => {
    const client = makeMockClient({ count: null, error: null, status: 200 });
    const result = await fetchOrgMembersSummary(client, "org-1");

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data.totalMembers).toBe(0);
    }
  });

  // ── 4. Forbidden on HTTP 403 ──────────────────────────────────────────────
  it("returns kind=forbidden on HTTP 403", async () => {
    const client = makeMockClient({
      count: null,
      error: { code: "42501", message: "insufficient_privilege" },
      status: 403,
    });
    const result = await fetchOrgMembersSummary(client, "org-1");

    expect(result.kind).toBe("forbidden");
  });

  // ── 5. Forbidden on SQLSTATE 42501 ────────────────────────────────────────
  it("returns kind=forbidden on SQLSTATE 42501 regardless of HTTP status", async () => {
    const client = makeMockClient({
      count: null,
      error: { code: "42501", message: "row-level security" },
      status: 400,
    });
    const result = await fetchOrgMembersSummary(client, "org-1");

    expect(result.kind).toBe("forbidden");
  });

  // ── 6. Generic server error ───────────────────────────────────────────────
  it("returns kind=error on server error", async () => {
    const client = makeMockClient({
      count: null,
      error: { code: "500", message: "Internal server error" },
      status: 500,
    });
    const result = await fetchOrgMembersSummary(client, "org-1");

    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("Internal server error");
    }
  });
});
