import { describe, it, expect, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fetchBranches } from "@/lib/queries/branches/branches";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type QueryResult = {
  data: unknown;
  error: { code?: string; message: string } | null;
  status: number;
};

/**
 * Builds a chainable Supabase-like query builder.
 * Supports the .select().in().is() chain used by fetchBranches.
 */
function makeBuilder(result: QueryResult) {
  const p = Promise.resolve(result);
  const builder: Record<string, unknown> & PromiseLike<QueryResult> = {
    select: () => builder,
    eq: () => builder,
    is: () => builder,
    in: () => builder,
    maybeSingle: () => builder,
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

const BRANCH_ROWS = [
  {
    id: "branch-1",
    name: "Warszawa",
    organization_id: "org-1",
    slug: "warszawa",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "branch-2",
    name: "Kraków",
    organization_id: "org-1",
    slug: null,
    created_at: "2026-01-02T00:00:00Z",
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("fetchBranches", () => {
  // ── 1. Successful fetch returns normalized rows ───────────────────────────
  it("returns kind=data with normalized branch rows on success", async () => {
    const mock = makeMock({ data: BRANCH_ROWS, error: null, status: 200 });

    const result = await fetchBranches(mock, ["branch-1", "branch-2"]);

    expect(result.kind).toBe("data");
    if (result.kind === "data") {
      expect(result.data).toEqual([
        {
          id: "branch-1",
          name: "Warszawa",
          organization_id: "org-1",
          slug: "warszawa",
          created_at: "2026-01-01T00:00:00Z",
        },
        {
          id: "branch-2",
          name: "Kraków",
          organization_id: "org-1",
          slug: null,
          created_at: "2026-01-02T00:00:00Z",
        },
      ]);
    }
  });

  // ── 2. Empty result is valid data — not "empty" ───────────────────────────
  it("returns kind=data with empty array when query returns zero rows", async () => {
    // A branch may have been deleted since the JWT was issued — this is
    // a valid state, not a missing-row sentinel (kind="empty" is not used here).
    const mock = makeMock({ data: [], error: null, status: 200 });

    const result = await fetchBranches(mock, ["branch-deleted"]);

    expect(result).toEqual({ kind: "data", data: [] });
  });

  // ── 3. SQLSTATE 42501 → forbidden ────────────────────────────────────────
  it("returns kind=forbidden on SQLSTATE 42501", async () => {
    const mock = makeMock({
      data: null,
      error: { code: "42501", message: "insufficient_privilege" },
      status: 200,
    });

    const result = await fetchBranches(mock, ["branch-1"]);
    expect(result.kind).toBe("forbidden");
  });

  // ── 4. HTTP 500 → error with message ─────────────────────────────────────
  it("returns kind=error with message on HTTP 500", async () => {
    const mock = makeMock({
      data: null,
      error: { message: "internal server error" },
      status: 500,
    });

    const result = await fetchBranches(mock, ["branch-1"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toBe("internal server error");
    }
  });
});
