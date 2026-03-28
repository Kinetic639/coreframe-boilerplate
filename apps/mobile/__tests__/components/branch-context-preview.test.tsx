import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import type { AppState, AppBootstrapState } from "@/contexts/app-context";
import type { ActiveBranch } from "@/hooks/use-active-branch";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
}));

const mockUseActiveBranch = vi.fn();
vi.mock("@/hooks/use-active-branch", () => ({
  useActiveBranch: () => mockUseActiveBranch(),
}));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_APP_STATE: AppState = {
  userId: "u1",
  email: "test@example.com",
  roles: [],
  activeOrgId: "org-1",
  orgRoles: [],
  activeBranchId: null,
  branchRoles: [],
  accessibleBranchIds: [],
  branchPermissions: null,
  permissions: { allow: [], deny: [] },
  entitlements: null,
  orgName: null,
  orgName2: null,
};

function makeContext(overrides: Partial<AppState> = {}) {
  return {
    bootstrapState: "resolved" as AppBootstrapState,
    appState: { ...BASE_APP_STATE, ...overrides },
    retryBootstrap: vi.fn(),
    switchBranch: vi.fn(),
  };
}

// ─── Import after mocks ───────────────────────────────────────────────────────

// eslint-disable-next-line import/first
import { BranchContextPreview } from "@/components/branch-context-preview";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BranchContextPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── T1: no active branch ──────────────────────────────────────────────────
  it("renders (none) for branch and permissions when no active branch is set", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: null, branchPermissions: null, accessibleBranchIds: [] })
    );
    mockUseActiveBranch.mockReturnValue({
      id: null,
      name: null,
      isLoading: false,
    } satisfies ActiveBranch);

    render(<BranchContextPreview scheme="light" />);

    // "(none)" appears for Active Branch and Permissions
    const noneMatches = screen.getAllByText("(none)");
    expect(noneMatches.length).toBeGreaterThanOrEqual(2);
    // accessible branch count
    expect(screen.getByText("0")).toBeTruthy();
  });

  // ── T2: loading state ─────────────────────────────────────────────────────
  it("renders (loading…) for branch name while query is in flight", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "b1", accessibleBranchIds: ["b1"] })
    );
    mockUseActiveBranch.mockReturnValue({
      id: "b1",
      name: null,
      isLoading: true,
    } satisfies ActiveBranch);

    render(<BranchContextPreview scheme="light" />);

    expect(screen.getByText("(loading…)")).toBeTruthy();
  });

  // ── T3: resolved branch name ──────────────────────────────────────────────
  it("renders resolved branch name when useActiveBranch returns a name", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "b1", accessibleBranchIds: ["b1"] })
    );
    mockUseActiveBranch.mockReturnValue({
      id: "b1",
      name: "Warszawa",
      isLoading: false,
    } satisfies ActiveBranch);

    render(<BranchContextPreview scheme="light" />);

    expect(screen.getByText("Warszawa")).toBeTruthy();
  });

  // ── T4: unresolved branch (not found in data) ─────────────────────────────
  it("renders (unresolved) when activeBranchId is set but name resolves to null", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "b-zzz", accessibleBranchIds: ["b-zzz"] })
    );
    mockUseActiveBranch.mockReturnValue({
      id: "b-zzz",
      name: null,
      isLoading: false,
    } satisfies ActiveBranch);

    render(<BranchContextPreview scheme="light" />);

    expect(screen.getByText("(unresolved)")).toBeTruthy();
  });

  // ── T5: permissions allow count ───────────────────────────────────────────
  it("renders allow count when branchPermissions is present", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({
        activeBranchId: "b1",
        accessibleBranchIds: ["b1"],
        branchPermissions: { allow: ["branch.roles.manage", "tools.read"], deny: [] },
      })
    );
    mockUseActiveBranch.mockReturnValue({
      id: "b1",
      name: "Warszawa",
      isLoading: false,
    } satisfies ActiveBranch);

    render(<BranchContextPreview scheme="light" />);

    expect(screen.getByText("2 allow")).toBeTruthy();
  });

  // ── T6: accessible branch count ───────────────────────────────────────────
  it("renders correct accessible branch count", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({
        activeBranchId: "b1",
        accessibleBranchIds: ["b1", "b2", "b3"],
      })
    );
    mockUseActiveBranch.mockReturnValue({
      id: "b1",
      name: "Warszawa",
      isLoading: false,
    } satisfies ActiveBranch);

    render(<BranchContextPreview scheme="light" />);

    expect(screen.getByText("3")).toBeTruthy();
  });
});
