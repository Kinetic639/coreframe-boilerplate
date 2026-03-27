import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { QueryResult } from "@/lib/queries/types";
import type { BranchData } from "@/lib/queries/branches/branches";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

const mockFetchBranches = vi.fn<(...args: unknown[]) => Promise<QueryResult<BranchData[]>>>();

vi.mock("@/lib/queries/branches/branches", () => ({
  fetchBranches: (...args: unknown[]) => mockFetchBranches(...args),
}));

// ─── Import after mocks ───────────────────────────────────────────────────────

const { useBranchesQuery } = await import("@/hooks/queries/branches/use-branches-query");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children);
  };
}

const BRANCH_DATA: BranchData[] = [
  {
    id: "branch-aaa",
    name: "Kraków",
    organization_id: "org-1",
    slug: "krakow",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "branch-bbb",
    name: "Warszawa",
    organization_id: "org-1",
    slug: null,
    created_at: "2026-01-02T00:00:00Z",
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useBranchesQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Empty branchIds → loading, fetchBranches not called ───────────────
  it("returns loading and does not call fetchBranches when branchIds is empty", () => {
    const { result } = renderHook(() => useBranchesQuery([]), {
      wrapper: makeWrapper(),
    });

    expect(result.current.kind).toBe("loading");
    expect(mockFetchBranches).not.toHaveBeenCalled();
  });

  // ── 2. Duplicate and unsorted IDs are normalized before key and query ─────
  it("passes deduplicated sorted IDs to fetchBranches regardless of input order", async () => {
    mockFetchBranches.mockResolvedValue({ kind: "data", data: BRANCH_DATA });

    // Input: duplicated and reversed compared to expected normalized form
    const rawIds = ["branch-bbb", "branch-aaa", "branch-bbb"];
    const expectedNormalized = ["branch-aaa", "branch-bbb"]; // deduped + sorted

    const { result } = renderHook(() => useBranchesQuery(rawIds), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("data"));

    // fetchBranches must be called with the normalized array
    expect(mockFetchBranches).toHaveBeenCalledWith(
      expect.anything(), // mobileSupabase
      expectedNormalized
    );
    expect(mockFetchBranches).toHaveBeenCalledTimes(1);
  });

  // ── 3. Loading while fetch is in flight ───────────────────────────────────
  it("returns loading while fetchBranches is pending", () => {
    // Never resolves — keeps query in loading state
    mockFetchBranches.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useBranchesQuery(["branch-1"]), {
      wrapper: makeWrapper(),
    });

    expect(result.current.kind).toBe("loading");
  });

  // ── 4. Resolved data propagates through hook ──────────────────────────────
  it("returns kind=data when fetchBranches resolves with data", async () => {
    mockFetchBranches.mockResolvedValue({ kind: "data", data: BRANCH_DATA });

    const { result } = renderHook(() => useBranchesQuery(["branch-aaa", "branch-bbb"]), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("data"));
    if (result.current.kind === "data") {
      expect(result.current.data).toEqual(BRANCH_DATA);
    }
  });
});
