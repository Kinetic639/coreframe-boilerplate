import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useOrgMembersList } from "@/hooks/queries/organization/use-org-members-list";
import type { OrgMemberItem } from "@/hooks/queries/organization/use-org-members-list";
import type { QueryResult } from "@/lib/queries/types";

import { fetchOrgMembersList } from "@/lib/queries/organization/org-members-list";

vi.mock("@/lib/queries/organization/org-members-list", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/queries/organization/org-members-list")>();
  return { ...original, fetchOrgMembersList: vi.fn() };
});

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));
const mockFetch = vi.mocked(fetchOrgMembersList);

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MEMBER_ITEMS: OrgMemberItem[] = [
  {
    userId: "user-1",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Smith",
    avatarUrl: null,
    joinedAt: "2026-01-01T00:00:00Z",
  },
];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useOrgMembersList", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── 1. Loading while query is in flight ───────────────────────────────────
  it("returns kind=loading while the query is pending", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.kind).toBe("loading");
  });

  // ── 2. Loading when orgId is null (query disabled) ────────────────────────
  it("returns kind=loading when orgId is null and does not call fetch", () => {
    const { result } = renderHook(() => useOrgMembersList(null), {
      wrapper: createWrapper(),
    });
    expect(result.current.kind).toBe("loading");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── 3. kind=data with member array on success ─────────────────────────────
  it("returns kind=data with member items on success", async () => {
    const resolution: QueryResult<OrgMemberItem[]> = {
      kind: "data",
      data: MEMBER_ITEMS,
    };
    mockFetch.mockResolvedValue(resolution);

    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("data"));
    if (result.current.kind === "data") {
      expect(result.current.data).toHaveLength(1);
      expect(result.current.data).toMatchObject([{ email: "alice@example.com" }]);
    }
  });

  // ── 4. kind=empty when query fn returns empty ─────────────────────────────
  it("returns kind=empty when the query fn returns empty (no active members)", async () => {
    mockFetch.mockResolvedValue({ kind: "empty" });
    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("empty"));
  });

  // ── 5. kind=forbidden propagated from query fn ────────────────────────────
  it("returns kind=forbidden when the query fn returns forbidden", async () => {
    mockFetch.mockResolvedValue({ kind: "forbidden" });
    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("forbidden"));
  });

  // ── 6. kind=error propagated from query fn ────────────────────────────────
  it("returns kind=error when the query fn returns error", async () => {
    mockFetch.mockResolvedValue({ kind: "error", message: "DB timeout" });
    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("error"));
    if (result.current.kind === "error") {
      expect(result.current.message).toBe("DB timeout");
    }
  });

  // ── 7. kind=error when query fn throws (network failure) ─────────────────
  it("returns kind=error when the query fn throws (network failure)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("error"));
  });

  // ── 8. Calls fetchOrgMembersList with the provided orgId ─────────────────
  it("calls fetchOrgMembersList with the provided orgId", async () => {
    mockFetch.mockResolvedValue({ kind: "empty" });
    renderHook(() => useOrgMembersList("org-abc"), { wrapper: createWrapper() });
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.anything(), "org-abc"));
  });

  // ── Defensive: invariant-failure guard (contract violation coverage) ──────
  // Documents that the hook always surfaces kind=error if a query fn returns
  // undefined — a violation of the QueryResult contract. TanStack Query v5
  // itself rejects undefined query results before our explicit guard is reached,
  // so the hook is doubly protected. Either path produces kind=error; the exact
  // message is TanStack-internal and not asserted here.
  it("returns kind=error when the query fn returns undefined (contract violation)", async () => {
    mockFetch.mockResolvedValue(undefined as never);
    const { result } = renderHook(() => useOrgMembersList("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("error"));
  });
});
