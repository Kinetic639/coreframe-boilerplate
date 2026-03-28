import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import type { AppState } from "@/contexts/app-context";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterPush = vi.fn();
const mockSignOut = vi.fn().mockResolvedValue(undefined);

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

vi.mock("@/hooks/use-tab-bar-inset", () => ({
  useTabBarBottomInset: () => 0,
}));

vi.mock("@/contexts/auth-context", () => ({
  useAuth: () => ({ signOut: mockSignOut }),
}));

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
}));

const mockUseActiveBranch = vi.fn();
vi.mock("@/hooks/use-active-branch", () => ({
  useActiveBranch: () => mockUseActiveBranch(),
}));

vi.mock("@/components/branch-context-preview", () => ({
  BranchContextPreview: () =>
    React.createElement("div", { "data-testid": "branch-context-preview" }),
}));

// ─── Import screen after mocks ────────────────────────────────────────────────

// eslint-disable-next-line import/first
import MoreScreen from "@/app/(app)/(tabs)/more";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_APP_STATE: AppState = {
  userId: "user-1",
  email: "user@example.com",
  roles: [],
  activeOrgId: "org-1",
  orgRoles: [],
  activeBranchId: null,
  branchRoles: [],
  accessibleBranchIds: [],
  branchPermissions: null,
  permissions: { allow: [], deny: [] },
  entitlements: null,
  orgName: "Acme Corp",
  orgName2: null,
};

function makeContext(overrides: Partial<AppState> = {}) {
  return {
    bootstrapState: "resolved" as const,
    appState: { ...BASE_APP_STATE, ...overrides },
    retryBootstrap: vi.fn(),
    switchBranch: vi.fn(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MoreScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignOut.mockResolvedValue(undefined);
    mockUseAppContext.mockReturnValue(makeContext());
    // Default: no active branch name (same visual output as before useActiveBranch was added)
    mockUseActiveBranch.mockReturnValue({ id: null, name: null, isLoading: false });
  });

  // ── 1. Header title ───────────────────────────────────────────────────────
  it("renders Więcej header title", () => {
    render(<MoreScreen />);
    expect(screen.getByText("Więcej")).toBeTruthy();
  });

  // ── 2. Diagnostics row label ──────────────────────────────────────────────
  it("renders Diagnostyka row label", () => {
    render(<MoreScreen />);
    expect(screen.getByText("Diagnostyka")).toBeTruthy();
  });

  // ── 3. Row press navigates to diagnostics ─────────────────────────────────
  it("calls router.push with /(app)/diagnostics when Diagnostyka row is pressed", () => {
    render(<MoreScreen />);
    const row = screen.getByRole("button", { name: "Open Diagnostics" });
    fireEvent.click(row);
    expect(mockRouterPush).toHaveBeenCalledWith("/(app)/diagnostics");
  });

  // ── 4. Sign-out button visible ────────────────────────────────────────────
  it("renders Wyloguj się sign-out button", () => {
    render(<MoreScreen />);
    expect(screen.getByText("Wyloguj się")).toBeTruthy();
  });

  // ── 5. Sign-out button calls signOut ──────────────────────────────────────
  it("calls signOut when Wyloguj się is pressed", () => {
    render(<MoreScreen />);
    const btn = screen.getByRole("button", { name: "Sign out" });
    fireEvent.click(btn);
    expect(mockSignOut).toHaveBeenCalledTimes(1);
  });

  // ── 6. Branch section hidden when accessibleBranchIds is empty ───────────
  it("does not render the branch section when user has no accessible branches", () => {
    mockUseAppContext.mockReturnValue(makeContext({ accessibleBranchIds: [] }));
    render(<MoreScreen />);

    expect(screen.queryByText("Przełącz oddział")).toBeNull();
    expect(screen.queryByText("Oddział")).toBeNull();
  });

  // ── 7. Branch section rendered when accessibleBranchIds is non-empty ──────
  it("renders Przełącz oddział row when user has at least one accessible branch", () => {
    mockUseAppContext.mockReturnValue(makeContext({ accessibleBranchIds: ["branch-1"] }));
    render(<MoreScreen />);

    expect(screen.getByText("Przełącz oddział")).toBeTruthy();
    expect(screen.getByText("Oddział")).toBeTruthy();
  });

  // ── 8. Branch row tap navigates to branch-select screen ──────────────────
  it("navigates to /(app)/branch-select when branch row is tapped", () => {
    mockUseAppContext.mockReturnValue(makeContext({ accessibleBranchIds: ["branch-1"] }));
    render(<MoreScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Switch branch/i }));

    expect(mockRouterPush).toHaveBeenCalledWith("/(app)/branch-select");
  });

  // ── 9. Active branch name shown inline when resolved ─────────────────────
  it("shows active branch name inline on the Przełącz oddział row when resolved", () => {
    mockUseAppContext.mockReturnValue(makeContext({ accessibleBranchIds: ["branch-1"] }));
    mockUseActiveBranch.mockReturnValue({ id: "branch-1", name: "Warszawa", isLoading: false });
    render(<MoreScreen />);

    expect(screen.getByText("Warszawa")).toBeTruthy();
  });

  // ── 10. Branch name hidden while loading ─────────────────────────────────
  it("does not show branch name while the branch query is loading", () => {
    mockUseAppContext.mockReturnValue(makeContext({ accessibleBranchIds: ["branch-1"] }));
    mockUseActiveBranch.mockReturnValue({ id: "branch-1", name: null, isLoading: true });
    render(<MoreScreen />);

    expect(screen.queryByText("Warszawa")).toBeNull();
    // Row label still present
    expect(screen.getByText("Przełącz oddział")).toBeTruthy();
  });

  // ── 11. BranchContextPreview mounted ─────────────────────────────────────
  it("renders BranchContextPreview in the scroll content", () => {
    render(<MoreScreen />);
    expect(screen.getByTestId("branch-context-preview")).toBeTruthy();
  });
});
