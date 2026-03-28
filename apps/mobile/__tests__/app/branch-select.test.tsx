import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

import type { AppState } from "@/contexts/app-context";
import type { HookResult } from "@/lib/queries/types";
import type { BranchData } from "@/lib/queries/branches/branches";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockRouterBack = vi.fn();

vi.mock("expo-router", () => ({
  useRouter: () => ({ back: mockRouterBack }),
}));

vi.mock("@/lib/supabase/client", () => ({ mobileSupabase: {} }));

vi.mock("@/hooks/use-color-scheme", () => ({
  useColorScheme: () => "light",
}));

const mockSwitchBranch = vi.fn();
const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
}));

const mockUseBranchesQuery = vi.fn();
vi.mock("@/hooks/queries/branches/use-branches-query", () => ({
  useBranchesQuery: () => mockUseBranchesQuery(),
}));

// ─── Import screen after mocks ────────────────────────────────────────────────

// eslint-disable-next-line import/first
import BranchSelectScreen from "@/app/(app)/branch-select";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_APP_STATE: AppState = {
  userId: "user-1",
  email: "user@example.com",
  roles: [],
  activeOrgId: "org-1",
  orgRoles: [],
  activeBranchId: "branch-1",
  branchRoles: [],
  accessibleBranchIds: ["branch-1", "branch-2"],
  branchPermissions: null,
  permissions: { allow: [], deny: [] },
  entitlements: null,
  orgName: "Acme Corp",
  orgName2: null,
};

const BRANCHES: BranchData[] = [
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

function makeContext(overrides: Partial<AppState> = {}) {
  return {
    bootstrapState: "resolved" as const,
    appState: { ...BASE_APP_STATE, ...overrides },
    retryBootstrap: vi.fn(),
    switchBranch: mockSwitchBranch,
  };
}

function makeDataResult(branches: BranchData[]): HookResult<BranchData[]> {
  return { kind: "data", data: branches };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("BranchSelectScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppContext.mockReturnValue(makeContext());
    mockUseBranchesQuery.mockReturnValue(makeDataResult(BRANCHES));
  });

  // ── 1. Renders branch names from query result ─────────────────────────────
  it("renders all branch names returned by useBranchesQuery", () => {
    render(<BranchSelectScreen />);

    expect(screen.getByText("Warszawa")).toBeTruthy();
    expect(screen.getByText("Kraków")).toBeTruthy();
  });

  // ── 2. Both branch rows are accessible via their labels ──────────────────
  it("renders an accessible button for each branch returned by the query", () => {
    render(<BranchSelectScreen />);

    // Both branches have accessible button roles with descriptive labels
    expect(screen.getByRole("button", { name: /Select branch Warszawa/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Select branch Kraków/i })).toBeTruthy();
  });

  // ── 3. Tapping an inactive branch calls switchBranch and router.back ──────
  it("calls switchBranch with branch id and navigates back when inactive branch tapped", () => {
    render(<BranchSelectScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Select branch Kraków/i }));

    expect(mockSwitchBranch).toHaveBeenCalledWith("branch-2");
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // ── 4. Tapping the active branch does not call switchBranch ──────────────
  it("does not call switchBranch when the already-active branch is tapped", () => {
    render(<BranchSelectScreen />);

    fireEvent.click(screen.getByRole("button", { name: /Select branch Warszawa/i }));

    expect(mockSwitchBranch).not.toHaveBeenCalled();
    expect(mockRouterBack).toHaveBeenCalledTimes(1);
  });

  // ── 5. Loading state shows spinner ───────────────────────────────────────
  it("shows loading indicator while query is in flight", () => {
    mockUseBranchesQuery.mockReturnValue({ kind: "loading" });
    render(<BranchSelectScreen />);

    // No branch names visible; ActivityIndicator is rendered
    expect(screen.queryByText("Warszawa")).toBeNull();
    expect(screen.queryByText("Kraków")).toBeNull();
  });
});
