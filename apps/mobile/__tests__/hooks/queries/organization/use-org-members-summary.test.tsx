import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useOrgMembersSummary } from "@/hooks/queries/organization/use-org-members-summary";
import type { OrgMembersSummary } from "@/lib/queries/organization/org-members-summary";
import type { QueryResult } from "@/lib/queries/types";

import { fetchOrgMembersSummary } from "@/lib/queries/organization/org-members-summary";

vi.mock("@/lib/queries/organization/org-members-summary", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/queries/organization/org-members-summary")>();
  return { ...original, fetchOrgMembersSummary: vi.fn() };
});

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));
const mockFetch = vi.mocked(fetchOrgMembersSummary);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

describe("useOrgMembersSummary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns kind=loading while query is in flight", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useOrgMembersSummary("org-1"), {
      wrapper: createWrapper(),
    });
    expect(result.current.kind).toBe("loading");
  });

  it("returns kind=loading when orgId is null", () => {
    const { result } = renderHook(() => useOrgMembersSummary(null), {
      wrapper: createWrapper(),
    });
    expect(result.current.kind).toBe("loading");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns kind=data with totalMembers on success", async () => {
    const resolution: QueryResult<OrgMembersSummary> = {
      kind: "data",
      data: { totalMembers: 7 },
    };
    mockFetch.mockResolvedValue(resolution);

    const { result } = renderHook(() => useOrgMembersSummary("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("data"));
    if (result.current.kind === "data") {
      expect(result.current.data.totalMembers).toBe(7);
    }
  });

  it("returns kind=forbidden when query fn returns forbidden", async () => {
    mockFetch.mockResolvedValue({ kind: "forbidden" });
    const { result } = renderHook(() => useOrgMembersSummary("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("forbidden"));
  });

  it("returns kind=error when query fn returns error", async () => {
    mockFetch.mockResolvedValue({ kind: "error", message: "DB timeout" });
    const { result } = renderHook(() => useOrgMembersSummary("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("error"));
    if (result.current.kind === "error") {
      expect(result.current.message).toBe("DB timeout");
    }
  });

  it("returns kind=error when query fn throws (network failure)", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useOrgMembersSummary("org-1"), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.kind).toBe("error"));
  });

  it("calls fetchOrgMembersSummary with the provided orgId", async () => {
    mockFetch.mockResolvedValue({ kind: "data", data: { totalMembers: 3 } });
    renderHook(() => useOrgMembersSummary("org-abc"), { wrapper: createWrapper() });
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

    const { result } = renderHook(() => useOrgMembersSummary("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("error"));
  });
});
