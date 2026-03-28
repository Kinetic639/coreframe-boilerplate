import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

import type { AppState, AppBootstrapState } from "@/contexts/app-context";
import type { HookResult } from "@/lib/queries/types";
import type { BranchData } from "@/lib/queries/branches/branches";

// ─── Import after mocks ───────────────────────────────────────────────────────

import { useActiveBranch } from "@/hooks/use-active-branch";

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUseAppContext = vi.fn();
vi.mock("@/contexts/app-context", () => ({
  useAppContext: () => mockUseAppContext(),
}));

const mockUseBranchesQuery = vi.fn();
vi.mock("@/hooks/queries/branches/use-branches-query", () => ({
  useBranchesQuery: (...args: unknown[]) => mockUseBranchesQuery(...args),
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

const BRANCH_AAA: BranchData = {
  id: "branch-aaa",
  name: "Warszawa",
  organization_id: "org-1",
  slug: "warszawa",
  created_at: "2026-01-01T00:00:00Z",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("useActiveBranch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBranchesQuery.mockReturnValue({ kind: "loading" } satisfies HookResult<BranchData[]>);
  });

  // ── T1: activeBranchId null → no-op result ────────────────────────────────
  it("returns id:null name:null isLoading:false when activeBranchId is null", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: null, accessibleBranchIds: [] })
    );

    const { result } = renderHook(() => useActiveBranch());

    expect(result.current).toEqual({ id: null, name: null, isLoading: false });
  });

  // ── T2: activeBranchId set, query loading ────────────────────────────────
  it("returns id set, name:null, isLoading:true while branch query is loading", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "branch-aaa", accessibleBranchIds: ["branch-aaa"] })
    );
    mockUseBranchesQuery.mockReturnValue({ kind: "loading" } satisfies HookResult<BranchData[]>);

    const { result } = renderHook(() => useActiveBranch());

    expect(result.current).toEqual({ id: "branch-aaa", name: null, isLoading: true });
  });

  // ── T3: activeBranchId set, branch found in data ──────────────────────────
  it("returns resolved name when activeBranchId matches a branch in data", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "branch-aaa", accessibleBranchIds: ["branch-aaa"] })
    );
    mockUseBranchesQuery.mockReturnValue({
      kind: "data",
      data: [BRANCH_AAA],
    } satisfies HookResult<BranchData[]>);

    const { result } = renderHook(() => useActiveBranch());

    expect(result.current).toEqual({ id: "branch-aaa", name: "Warszawa", isLoading: false });
  });

  // ── T4: activeBranchId set, not found in data (deleted branch) ───────────
  it("returns name:null when activeBranchId is not found in branch data", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "branch-zzz", accessibleBranchIds: ["branch-zzz"] })
    );
    mockUseBranchesQuery.mockReturnValue({
      kind: "data",
      data: [BRANCH_AAA], // does not contain branch-zzz
    } satisfies HookResult<BranchData[]>);

    const { result } = renderHook(() => useActiveBranch());

    expect(result.current).toEqual({ id: "branch-zzz", name: null, isLoading: false });
  });

  // ── T5: activeBranchId set, query error ──────────────────────────────────
  it("returns name:null isLoading:false when branch query returns error", () => {
    mockUseAppContext.mockReturnValue(
      makeContext({ activeBranchId: "branch-aaa", accessibleBranchIds: ["branch-aaa"] })
    );
    mockUseBranchesQuery.mockReturnValue({
      kind: "error",
      message: "network failure",
    } satisfies HookResult<BranchData[]>);

    const { result } = renderHook(() => useActiveBranch());

    expect(result.current).toEqual({ id: "branch-aaa", name: null, isLoading: false });
  });
});
