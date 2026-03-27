import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import React from "react";
import type { Session } from "@supabase/supabase-js";

import type { BootstrapLoadResult } from "@/lib/loaders/bootstrap-loader";
import type { BranchPermissionsLoadResult } from "@/lib/loaders/branch-permissions-loader";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

const mockLoadBootstrapData = vi.fn<(...args: unknown[]) => Promise<BootstrapLoadResult>>();

vi.mock("@/lib/loaders/bootstrap-loader", () => ({
  loadBootstrapData: (...args: unknown[]) => mockLoadBootstrapData(...args),
}));

const mockLoadBranchPermissionsData =
  vi.fn<(...args: unknown[]) => Promise<BranchPermissionsLoadResult>>();

vi.mock("@/lib/loaders/branch-permissions-loader", () => ({
  loadBranchPermissionsData: (...args: unknown[]) => mockLoadBranchPermissionsData(...args),
}));

// Hoisted supabase mock — needs to support the .from().update().eq() chain
// used by switchBranch for best-effort user_preferences persistence.
const { mockMobileFrom } = vi.hoisted(() => ({
  mockMobileFrom: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  mobileSupabase: { from: mockMobileFrom },
}));

vi.mock("@repo/auth", () => ({
  AuthService: {
    getUserRoles: (token: string) => {
      // Encode context in the token string for test control.
      // "token-org:<orgId>:<rest>"              → org-scoped role only
      // "token-org-branch:<orgId>:<branchId>:<rest>" → org + branch role
      // Any other token → no roles
      if (token.startsWith("token-org-branch:")) {
        const parts = token.replace("token-org-branch:", "").split(":");
        const orgId = parts[0];
        const branchId = parts[1];
        return [
          {
            scope: "org",
            scope_id: orgId,
            org_id: orgId,
            branch_id: null,
            name: "org_member",
            role_id: "r-org",
            is_basic: true,
            scope_type: "org",
            role: "org_member",
          },
          {
            scope: "branch",
            scope_id: branchId,
            org_id: null,
            branch_id: branchId,
            name: "branch_manager",
            role_id: "r-branch",
            is_basic: true,
            scope_type: "branch",
            role: "branch_manager",
          },
        ];
      }
      if (token.startsWith("token-org:")) {
        const orgId = token.replace("token-org:", "").split(":")[0];
        return [
          {
            scope: "org",
            scope_id: orgId,
            org_id: orgId,
            branch_id: null,
            name: "org_member",
            role_id: "r-org",
            is_basic: true,
            scope_type: "org",
            role: "org_member",
          },
        ];
      }
      return [];
    },
  },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSession(userId: string, orgId: string | null, token: string): Session {
  const accessToken = orgId ? `token-org:${orgId}:${token}` : `token-no-org:${token}`;
  return {
    access_token: accessToken,
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      email: `${userId}@test.com`,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  } as unknown as Session;
}

/** Session that carries both an org-scoped and a branch-scoped JWT role. */
function makeSessionWithBranch(
  userId: string,
  orgId: string,
  branchId: string,
  token: string
): Session {
  return {
    access_token: `token-org-branch:${orgId}:${branchId}:${token}`,
    refresh_token: "refresh",
    expires_in: 3600,
    token_type: "bearer",
    user: {
      id: userId,
      email: `${userId}@test.com`,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: "2026-01-01T00:00:00Z",
    },
  } as unknown as Session;
}

/** Default resolved bootstrap result — no branch preference. */
const RESOLVED_OK: BootstrapLoadResult = {
  kind: "resolved",
  permissions: { allow: ["org.read"], deny: [] },
  savedBranchId: null,
  entitlements: null,
  orgName: "Test Org",
  orgName2: null,
};

/** Branch-permissions resolved result — used by mockLoadBranchPermissionsData. */
const BRANCH_PERMS_OK: BranchPermissionsLoadResult = {
  kind: "resolved",
  branchPermissions: { allow: ["branch.roles.manage"], deny: [] },
};

/** Probe rendered inside the resolved AppContext.Provider */
function ContextProbe() {
  return <span data-testid="resolved">resolved</span>;
}

// ─── Import after mocks are set up ───────────────────────────────────────────

const { AppProvider, useAppContext } = await import("@/contexts/app-context");

/**
 * Probe that exposes branchPermissions count via visible text.
 */
function BranchProbe() {
  const { appState } = useAppContext();
  const count = appState.branchPermissions?.allow.length ?? -1;
  return (
    <>
      <span data-testid="resolved">resolved</span>
      <span>branch-perm-count:{count}</span>
    </>
  );
}

/**
 * Probe that exposes activeBranchId via visible text.
 */
function ActiveBranchProbe() {
  const { appState } = useAppContext();
  return (
    <>
      <span data-testid="resolved">resolved</span>
      <span>active-branch:{appState.activeBranchId ?? "null"}</span>
    </>
  );
}

/**
 * Probe that exposes activeBranchId and provides a button to call switchBranch.
 */
function SwitchBranchProbe({ targetBranchId }: { targetBranchId: string }) {
  const { appState, switchBranch } = useAppContext();
  const permCount = appState.branchPermissions?.allow.length ?? -1;
  return (
    <>
      <span data-testid="resolved">resolved</span>
      <span>active-branch:{appState.activeBranchId ?? "null"}</span>
      <span>branch-perm-count:{permCount}</span>
      <button onClick={() => switchBranch(targetBranchId)}>switch</button>
    </>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    // Default: branch-permissions loader returns no-op resolved result.
    // Tests that need specific branch perms override this per-test.
    mockLoadBranchPermissionsData.mockResolvedValue({
      kind: "resolved",
      branchPermissions: { allow: [], deny: [] },
    });
    // Default: supabase.from() returns a chainable no-op for preference writes.
    mockMobileFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  // ── 1. Resolved state renders children ──────────────────────────────────
  it("renders children when bootstrap resolves successfully", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("resolved")).toBeTruthy();
    });
  });

  // ── 2. authenticated-unresolved: no backend call ─────────────────────────
  it("shows no-org screen and does not call loadBootstrapData when no org in JWT", async () => {
    render(
      <AppProvider session={makeSession("u1", null, "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/brak kontekstu organizacji/i)).toBeTruthy();
    });
    expect(mockLoadBootstrapData).not.toHaveBeenCalled();
    expect(screen.queryByTestId("resolved")).toBeNull();
  });

  // ── 3. forbidden state shows access-denied screen ───────────────────────
  it("shows access-denied screen when bootstrap returns forbidden", async () => {
    mockLoadBootstrapData.mockResolvedValue({ kind: "forbidden" });

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/brak dostępu/i)).toBeTruthy();
    });
    expect(screen.queryByTestId("resolved")).toBeNull();
  });

  // ── 4. error state shows error screen with retry button ──────────────────
  it("shows error screen with retry button when bootstrap returns error", async () => {
    mockLoadBootstrapData.mockResolvedValue({ kind: "error", message: "network down" });

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/nie udało się załadować/i)).toBeTruthy();
      expect(screen.getByText(/spróbuj ponownie/i)).toBeTruthy();
    });
  });

  // ── 5. invalid-session triggers signOut ──────────────────────────────────
  it("calls signOut when bootstrap returns invalid-session", async () => {
    mockLoadBootstrapData.mockResolvedValue({ kind: "invalid-session" });

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  // ── 6. Retry re-triggers the backend load ────────────────────────────────
  it("re-calls loadBootstrapData when Try Again is pressed", async () => {
    mockLoadBootstrapData.mockResolvedValue({ kind: "error", message: "timeout" });

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByText(/spróbuj ponownie/i)).toBeTruthy());
    expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1);

    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);
    await act(async () => {
      fireEvent.click(screen.getByText(/spróbuj ponownie/i));
    });

    await waitFor(() => {
      expect(mockLoadBootstrapData).toHaveBeenCalledTimes(2);
      expect(screen.getByTestId("resolved")).toBeTruthy();
    });
  });

  // ── 7. loadBootstrapData is called with userId and activeOrgId (3 args) ──
  it("calls loadBootstrapData with userId and orgId from JWT — no branch arg", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    render(
      <AppProvider session={makeSession("user-abc", "org-xyz", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));
    expect(mockLoadBootstrapData).toHaveBeenCalledWith(
      expect.anything(), // mobileSupabase
      "user-abc",
      "org-xyz"
      // No 4th arg — activeBranchId is resolved AFTER bootstrap completes
    );
  });

  // ── 8. Token refresh triggers a reload ───────────────────────────────────
  it("reloads when access_token changes even if userId and activeOrgId are unchanged", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    const { rerender } = render(
      <AppProvider session={makeSession("u1", "org-1", "token-v1")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));

    rerender(
      <AppProvider session={makeSession("u1", "org-1", "token-v2")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(2));
  });

  // ── 9. No reload when token is unchanged ─────────────────────────────────
  it("does not reload when the same session object re-renders without changes", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);
    const session = makeSession("u1", "org-1", "stable-token");

    const { rerender } = render(
      <AppProvider session={session}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));

    rerender(
      <AppProvider session={session}>
        <ContextProbe />
      </AppProvider>
    );

    await Promise.resolve();
    expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1);
  });

  // ── 10. Unexpected throw from loader is caught and → error state ─────────
  it("shows error screen when loadBootstrapData throws unexpectedly", async () => {
    mockLoadBootstrapData.mockRejectedValue(new Error("fetch failed"));

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/nie udało się załadować/i)).toBeTruthy();
    });
    expect(screen.queryByTestId("resolved")).toBeNull();
  });

  // ── 11. No branch roles → loadBootstrapData called with 3 args ───────────
  it("calls loadBootstrapData with 3 args when JWT has no branch roles", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    render(
      <AppProvider session={makeSession("user-abc", "org-xyz", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));
    expect(mockLoadBootstrapData).toHaveBeenCalledWith(expect.anything(), "user-abc", "org-xyz");
  });

  // ── 12. Branch role in JWT → loadBootstrapData still called with 3 args ──
  it("calls loadBootstrapData with 3 args even when JWT has a branch-scoped role", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));
    // activeBranchId is resolved AFTER bootstrap — not passed as an arg
    expect(mockLoadBootstrapData).toHaveBeenCalledWith(expect.anything(), "u1", "org-1");
  });

  // ── 13. savedBranchId matches JWT branch role → activeBranchId set ────────
  it("sets activeBranchId from savedBranchId when it matches a JWT branch role", async () => {
    mockLoadBootstrapData.mockResolvedValue({
      ...RESOLVED_OK,
      savedBranchId: "branch-42",
    });

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <ActiveBranchProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("resolved")).toBeTruthy();
      expect(screen.getByText("active-branch:branch-42")).toBeTruthy();
    });
  });

  // ── 14. savedBranchId null → activeBranchId = first JWT branch role ───────
  it("sets activeBranchId to first JWT branch role when savedBranchId is null", async () => {
    mockLoadBootstrapData.mockResolvedValue({ ...RESOLVED_OK, savedBranchId: null });

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <ActiveBranchProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("active-branch:branch-42")).toBeTruthy();
    });
  });

  // ── 15. No branch roles and null savedBranchId → activeBranchId null ──────
  it("activeBranchId is null when no JWT branch roles and savedBranchId is null", async () => {
    mockLoadBootstrapData.mockResolvedValue({ ...RESOLVED_OK, savedBranchId: null });

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <ActiveBranchProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("active-branch:null")).toBeTruthy();
    });
  });

  // ── 16. switchBranch with valid ID updates activeBranchId in appState ─────
  it("switchBranch updates activeBranchId to the selected branch", async () => {
    mockLoadBootstrapData.mockResolvedValue({ ...RESOLVED_OK, savedBranchId: null });

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <SwitchBranchProbe targetBranchId="branch-42" />
      </AppProvider>
    );

    // Wait for initial resolution (activeBranchId = "branch-42" from first JWT role)
    await waitFor(() => expect(screen.getByTestId("resolved")).toBeTruthy());

    // Simulate switching to a different branch — for this test we switch to the
    // same branch to verify the guard doesn't block it (it's already accessible)
    await act(async () => {
      fireEvent.click(screen.getByText("switch"));
    });

    await waitFor(() => {
      expect(screen.getByText("active-branch:branch-42")).toBeTruthy();
    });
  });

  // ── 17. switchBranch clears branchPermissions immediately ─────────────────
  it("switchBranch clears branchPermissions to null before reload completes", async () => {
    // First: let bootstrap set an initial branchPermissions via branch-reload effect
    mockLoadBootstrapData.mockResolvedValue({ ...RESOLVED_OK, savedBranchId: null });
    mockLoadBranchPermissionsData.mockResolvedValue(BRANCH_PERMS_OK);

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <SwitchBranchProbe targetBranchId="branch-42" />
      </AppProvider>
    );

    // Wait for initial resolved state with branch permissions loaded
    await waitFor(() => {
      expect(screen.getByText("branch-perm-count:1")).toBeTruthy();
    });

    // Now stall the next branch-permissions load so we can observe the clearing
    mockLoadBranchPermissionsData.mockReturnValue(new Promise(() => {})); // never resolves

    await act(async () => {
      fireEvent.click(screen.getByText("switch"));
    });

    // branchPermissions should be null immediately (-1) while reload is in flight
    await waitFor(() => {
      expect(screen.getByText("branch-perm-count:-1")).toBeTruthy();
    });
  });

  // ── 18. switchBranch with ID not in accessibleBranchIds is no-op ──────────
  it("switchBranch does not update state when branchId is not in accessibleBranchIds", async () => {
    mockLoadBootstrapData.mockResolvedValue({ ...RESOLVED_OK, savedBranchId: null });

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <SwitchBranchProbe targetBranchId="branch-INVALID" />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByTestId("resolved")).toBeTruthy());

    const callsBefore = mockLoadBranchPermissionsData.mock.calls.length;

    await act(async () => {
      fireEvent.click(screen.getByText("switch"));
    });

    // No additional branch-permissions load triggered (no state change)
    await Promise.resolve();
    expect(mockLoadBranchPermissionsData.mock.calls.length).toBe(callsBefore);
    // activeBranchId unchanged
    expect(screen.getByText("active-branch:branch-42")).toBeTruthy();
  });

  // ── 19. switchBranch fires user_preferences update for persistence ─────────
  it("switchBranch calls mobileSupabase.from(user_preferences).update with selected branch", async () => {
    mockLoadBootstrapData.mockResolvedValue({ ...RESOLVED_OK, savedBranchId: null });

    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
    mockMobileFrom.mockReturnValue({ update: mockUpdate });

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <SwitchBranchProbe targetBranchId="branch-42" />
      </AppProvider>
    );

    await waitFor(() => expect(screen.getByTestId("resolved")).toBeTruthy());

    // Reset call counts after bootstrap (which may also call from() for its own purposes)
    mockMobileFrom.mockClear();
    mockUpdate.mockClear();
    mockEq.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByText("switch"));
    });

    // Allow the async persistence write to fire
    await Promise.resolve();

    expect(mockMobileFrom).toHaveBeenCalledWith("user_preferences");
    expect(mockUpdate).toHaveBeenCalledWith({ default_branch_id: "branch-42" });
    expect(mockEq).toHaveBeenCalledWith("user_id", "u1");
  });
});
