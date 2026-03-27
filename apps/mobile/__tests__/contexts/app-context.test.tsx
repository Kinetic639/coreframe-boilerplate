import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import React from "react";
import type { Session } from "@supabase/supabase-js";

import type { BootstrapLoadResult } from "@/lib/loaders/bootstrap-loader";

// ─── Module mocks ─────────────────────────────────────────────────────────────

const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

const mockLoadBootstrapData = vi.fn<(...args: unknown[]) => Promise<BootstrapLoadResult>>();

vi.mock("@/lib/loaders/bootstrap-loader", () => ({
  loadBootstrapData: (...args: unknown[]) => mockLoadBootstrapData(...args),
}));

vi.mock("@/lib/supabase/client", () => ({
  mobileSupabase: {},
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

const RESOLVED_OK: BootstrapLoadResult = {
  kind: "resolved",
  permissions: { allow: ["org.read"], deny: [] },
  branchPermissions: null,
  entitlements: null,
  orgName: "Test Org",
  orgName2: null,
};

/** Probe rendered inside the resolved AppContext.Provider */
function ContextProbe() {
  return <span data-testid="resolved">resolved</span>;
}

// ─── Import after mocks are set up ───────────────────────────────────────────

const { AppProvider, useAppContext } = await import("@/contexts/app-context");

/**
 * Probe that exposes branch context state via visible text.
 * Uses getByText() pattern to avoid .textContent TS issues with es2022 lib.
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AppProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
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

  // ── 7. loadBootstrapData is called with userId and activeOrgId ───────────
  it("calls loadBootstrapData with the correct userId and orgId from the JWT", async () => {
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
      "org-xyz",
      null // no branch roles in this session
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

    // Same user, same org, different token value — simulates a silent token refresh
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

    // Allow any pending microtasks to settle
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

  // ── 11. Branch: no branch roles → null activeBranchId passed to loader ───
  it("calls loadBootstrapData with null activeBranchId when JWT has no branch roles", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    render(
      <AppProvider session={makeSession("user-abc", "org-xyz", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));
    expect(mockLoadBootstrapData).toHaveBeenCalledWith(
      expect.anything(),
      "user-abc",
      "org-xyz",
      null
    );
  });

  // ── 12. Branch: branch role in JWT → correct activeBranchId passed ───────
  it("calls loadBootstrapData with branch UUID when JWT has a branch-scoped role", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK);

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <ContextProbe />
      </AppProvider>
    );

    await waitFor(() => expect(mockLoadBootstrapData).toHaveBeenCalledTimes(1));
    expect(mockLoadBootstrapData).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "org-1",
      "branch-42"
    );
  });

  // ── 13. Branch: branchPermissions from resolved result → in appState ──────
  it("exposes branchPermissions from bootstrap result in appState", async () => {
    const resolvedWithBranch: BootstrapLoadResult = {
      ...RESOLVED_OK,
      branchPermissions: { allow: ["branch.roles.manage"], deny: [] },
    };
    mockLoadBootstrapData.mockResolvedValue(resolvedWithBranch);

    render(
      <AppProvider session={makeSessionWithBranch("u1", "org-1", "branch-42", "tok")}>
        <BranchProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("resolved")).toBeTruthy();
      expect(screen.getByText("branch-perm-count:1")).toBeTruthy();
    });
  });

  // ── 14. Branch: null branchPermissions when no active branch ─────────────
  it("exposes null branchPermissions in appState when bootstrap returns null branchPermissions", async () => {
    mockLoadBootstrapData.mockResolvedValue(RESOLVED_OK); // branchPermissions: null

    render(
      <AppProvider session={makeSession("u1", "org-1", "tok")}>
        <BranchProbe />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("resolved")).toBeTruthy();
      // -1 means appState.branchPermissions is null (no .allow array)
      expect(screen.getByText("branch-perm-count:-1")).toBeTruthy();
    });
  });
});
