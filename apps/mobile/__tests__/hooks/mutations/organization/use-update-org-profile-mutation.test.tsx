import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useUpdateOrgProfileMutation } from "@/hooks/mutations/organization/use-update-org-profile-mutation";
import { updateOrgProfile } from "@/lib/mutations/organization/update-org-profile";
import type { OrgProfileData } from "@/lib/queries/organization/org-profile";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock the mutation function — hook tests validate hook behavior only.
vi.mock("@/lib/mutations/organization/update-org-profile", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/mutations/organization/update-org-profile")>();
  return { ...original, updateOrgProfile: vi.fn() };
});

// Prevent expo-secure-store / expo-modules-core from being imported in jsdom.
vi.mock("@/lib/supabase/client", () => ({
  mobileSupabase: {},
}));

const mockUpdateOrgProfile = vi.mocked(updateOrgProfile);

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return { Wrapper, queryClient };
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

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

const VALID_INPUT = { name: "Acme Corp" };

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useUpdateOrgProfileMutation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Initial state ──────────────────────────────────────────────────────
  it("starts in idle state (not pending, not success, not error)", () => {
    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateOrgProfileMutation("org-1"), {
      wrapper: Wrapper,
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.isError).toBe(false);
  });

  // ── 2. isPending during in-flight call ───────────────────────────────────
  it("sets isPending=true while the mutation is in flight", async () => {
    const { Wrapper } = createWrapper();
    let resolve!: (v: OrgProfileData) => void;
    mockUpdateOrgProfile.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { result } = renderHook(() => useUpdateOrgProfileMutation("org-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(VALID_INPUT);
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));

    // Resolve to avoid dangling promise
    act(() => {
      resolve(PROFILE_DATA);
    });
  });

  // ── 3. isSuccess after successful mutation ───────────────────────────────
  it("sets isSuccess=true after a successful mutation", async () => {
    const { Wrapper } = createWrapper();
    mockUpdateOrgProfile.mockResolvedValue(PROFILE_DATA);

    const { result } = renderHook(() => useUpdateOrgProfileMutation("org-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(VALID_INPUT);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
  });

  // ── 4. isError after thrown mutation ────────────────────────────────────
  it("sets isError=true and exposes error.message when mutation throws", async () => {
    const { Wrapper } = createWrapper();
    mockUpdateOrgProfile.mockRejectedValue(new Error("Validation failed"));

    const { result } = renderHook(() => useUpdateOrgProfileMutation("org-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(VALID_INPUT);
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Validation failed");
    expect(result.current.isSuccess).toBe(false);
  });

  // ── 5. invalidateQueries called on success ───────────────────────────────
  it("calls invalidateQueries for org-profile on success", async () => {
    const { Wrapper, queryClient } = createWrapper();
    mockUpdateOrgProfile.mockResolvedValue(PROFILE_DATA);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useUpdateOrgProfileMutation("org-1"), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.mutate(VALID_INPUT);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["org-profile", "org-1"] })
    );
  });
});
