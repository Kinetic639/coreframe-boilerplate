import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useOrgProfileQuery } from "@/hooks/queries/organization/use-org-profile-query";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";
import type { QueryResult } from "@/lib/queries/types";

import { fetchOrgProfile } from "@/lib/queries/organization/org-profile";

// ─── Mock fetchOrgProfile ─────────────────────────────────────────────────────
// Mock the query function — hook tests validate hook behavior only.
vi.mock("@/lib/queries/organization/org-profile", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/queries/organization/org-profile")>();
  return { ...original, fetchOrgProfile: vi.fn() };
});

// Mock the Supabase client to prevent expo-secure-store / expo-modules-core
// from being imported (they require native globals not available in jsdom).
// The actual client value is irrelevant since fetchOrgProfile is fully mocked.
vi.mock("@/lib/supabase/client", () => ({
  mobileSupabase: {},
}));
const mockFetchOrgProfile = vi.mocked(fetchOrgProfile);

// ─── Test wrapper ─────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // no retries in tests — fail fast
        staleTime: 0,
      },
    },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return Wrapper;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PROFILE_DATA: OrgProfileData = {
  organization_id: "org-1",
  name: "Acme Corp",
  name_2: null,
  slug: "acme",
  bio: null,
  website: null,
  logo_url: null,
  theme_color: null,
  font_color: null,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useOrgProfileQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Loading state when query is in flight ─────────────────────────────
  it("returns kind=loading while the query is pending", () => {
    mockFetchOrgProfile.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    expect(result.current.kind).toBe("loading");
  });

  // ── 2. Loading state when orgId is null ──────────────────────────────────
  it("returns kind=loading when orgId is null (query disabled)", () => {
    const { result } = renderHook(() => useOrgProfileQuery(null), {
      wrapper: createWrapper(),
    });

    expect(result.current.kind).toBe("loading");
    expect(mockFetchOrgProfile).not.toHaveBeenCalled();
  });

  // ── 3. Resolves to kind=data on success ──────────────────────────────────
  it("returns kind=data with the profile after a successful fetch", async () => {
    const resolution: QueryResult<OrgProfileData> = { kind: "data", data: PROFILE_DATA };
    mockFetchOrgProfile.mockResolvedValue(resolution);

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("data"));

    if (result.current.kind === "data") {
      expect(result.current.data.organization_id).toBe("org-1");
      expect(result.current.data.name).toBe("Acme Corp");
    }
  });

  // ── 4. Propagates kind=empty from the query function ─────────────────────
  it("returns kind=empty when fetchOrgProfile returns empty", async () => {
    mockFetchOrgProfile.mockResolvedValue({ kind: "empty" });

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("empty"));
  });

  // ── 5. Propagates kind=forbidden from the query function ─────────────────
  it("returns kind=forbidden when fetchOrgProfile returns forbidden", async () => {
    mockFetchOrgProfile.mockResolvedValue({ kind: "forbidden" });

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("forbidden"));
  });

  // ── 6. Propagates kind=error from the query function ─────────────────────
  it("returns kind=error when fetchOrgProfile returns an error", async () => {
    mockFetchOrgProfile.mockResolvedValue({ kind: "error", message: "DB unavailable" });

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("error"));
    if (result.current.kind === "error") {
      expect(result.current.message).toBe("DB unavailable");
    }
  });

  // ── 7. Query key includes orgId ──────────────────────────────────────────
  it("calls fetchOrgProfile with the provided orgId", async () => {
    mockFetchOrgProfile.mockResolvedValue({ kind: "empty" });

    renderHook(() => useOrgProfileQuery("org-abc"), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(mockFetchOrgProfile).toHaveBeenCalledWith(expect.anything(), "org-abc")
    );
  });

  // ── 8. Network-level error (React Query throws) ──────────────────────────
  it("returns kind=error when the query function throws (network failure)", async () => {
    mockFetchOrgProfile.mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("error"));
    if (result.current.kind === "error") {
      expect(result.current.message).toBe("Network error");
    }
  });

  // ── 9. Defensive: invariant-failure guard (contract violation coverage) ───
  // Documents that the hook always surfaces kind=error if a query fn returns
  // undefined — a violation of the QueryResult contract. TanStack Query v5
  // itself rejects undefined query results before our explicit guard is reached,
  // so the hook is doubly protected. Either path produces kind=error; the exact
  // message is TanStack-internal and not asserted here.
  it("returns kind=error when the query fn returns undefined (contract violation)", async () => {
    mockFetchOrgProfile.mockResolvedValue(undefined as never);

    const { result } = renderHook(() => useOrgProfileQuery("org-1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.kind).toBe("error"));
  });
});
