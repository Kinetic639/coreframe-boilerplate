import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { loadBranchPermissionsData } from "@/lib/loaders/branch-permissions-loader";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
  status: number;
};

function makeBuilder(result: QueryResult) {
  const p = Promise.resolve(result);
  const builder: Record<string, unknown> & PromiseLike<QueryResult> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    then: <TResult1 = QueryResult, TResult2 = never>(
      onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
      onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
    ): Promise<TResult1 | TResult2> => p.then(onfulfilled, onrejected),
    catch: (onrejected?: ((reason: unknown) => unknown) | null) => p.catch(onrejected),
    finally: (onfinally?: (() => void) | null) => p.finally(onfinally),
  };
  return builder;
}

function makeMock(result: QueryResult): SupabaseClient {
  return {
    from: vi.fn(() => makeBuilder(result)),
  } as unknown as SupabaseClient;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("loadBranchPermissionsData", () => {
  // ── 1. Successful fetch → resolved with sorted allow list ─────────────────
  it("returns resolved branchPermissions with sorted allow list on success", async () => {
    const mock = makeMock({
      data: [
        { permission_slug_exact: "branch.roles.manage" },
        { permission_slug_exact: "members.read" },
      ],
      error: null,
      status: 200,
    });

    const result = await loadBranchPermissionsData(mock, "u1", "org-1", "branch-1");

    expect(result).toEqual({
      kind: "resolved",
      branchPermissions: {
        allow: ["branch.roles.manage", "members.read"],
        deny: [],
      },
    });
  });

  // ── 2. Empty result → resolved with empty allow list ─────────────────────
  it("returns resolved branchPermissions with empty allow when branch has no permissions", async () => {
    const mock = makeMock({ data: [], error: null, status: 200 });

    const result = await loadBranchPermissionsData(mock, "u1", "org-1", "branch-1");

    expect(result).toEqual({
      kind: "resolved",
      branchPermissions: { allow: [], deny: [] },
    });
  });

  // ── 3. SQLSTATE 42501 → forbidden ────────────────────────────────────────
  it("returns forbidden on SQLSTATE 42501", async () => {
    const mock = makeMock({
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
      status: 200,
    });

    const result = await loadBranchPermissionsData(mock, "u1", "org-1", "branch-1");
    expect(result.kind).toBe("forbidden");
  });

  // ── 4. HTTP 401 → invalid-session ────────────────────────────────────────
  it("returns invalid-session on HTTP 401", async () => {
    const mock = makeMock({
      data: null,
      error: { message: "JWT expired" },
      status: 401,
    });

    const result = await loadBranchPermissionsData(mock, "u1", "org-1", "branch-1");
    expect(result.kind).toBe("invalid-session");
  });
});
