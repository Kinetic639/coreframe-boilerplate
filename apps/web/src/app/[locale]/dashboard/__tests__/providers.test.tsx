/**
 * DashboardV2Providers — session-branch hydration behavior tests.
 *
 * Proves that the provider's useEffect correctly:
 *   T1: overrides the SSR-derived branch with a valid session-local branch
 *   T2: clears a stale session entry and falls back to the SSR-derived branch
 *
 * Uses real Zustand stores (same pattern as permissions-sync.test.tsx).
 * PermissionsSync and DashboardInitialLoader are mocked as no-ops to isolate
 * the session-branch logic under test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { ReactNode } from "react";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { useUserStoreV2 } from "@/lib/stores/v2/user-store";
import { getSessionBranchId } from "@/lib/session-branch";
import type { DashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("../_components/permissions-sync", () => ({
  PermissionsSync: () => null,
}));

vi.mock("../_components/dashboard-initial-loader", () => ({
  DashboardInitialLoader: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// ─── Import component after mocks ────────────────────────────────────────────

import { DashboardV2Providers } from "../_providers";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const ORG_ID = "org-1";

const BRANCH_A = {
  id: "branch-a",
  name: "Branch A",
  organization_id: ORG_ID,
  slug: "branch-a",
  created_at: "2024-01-01T00:00:00Z",
};

const BRANCH_B = {
  id: "branch-b",
  name: "Branch B",
  organization_id: ORG_ID,
  slug: "branch-b",
  created_at: "2024-01-02T00:00:00Z",
};

const BRANCH_C_STALE = {
  id: "branch-c-stale",
  name: "Deleted Branch",
  organization_id: ORG_ID,
  slug: "branch-c-stale",
  created_at: "2024-01-03T00:00:00Z",
};

function makeContext(overrides: Partial<DashboardContextV2["app"]> = {}): DashboardContextV2 {
  return {
    app: {
      activeOrgId: ORG_ID,
      activeBranchId: BRANCH_A.id,
      activeOrg: {
        id: ORG_ID,
        name: "Test Org",
        name_2: null,
        slug: "test-org",
        logo_url: null,
      },
      activeBranch: BRANCH_A,
      availableBranches: [BRANCH_A, BRANCH_B],
      accessibleBranches: [BRANCH_A, BRANCH_B],
      userModules: [],
      ...overrides,
    },
    user: {
      user: {
        id: "user-1",
        email: "test@example.com",
        first_name: null,
        last_name: null,
        avatar_url: null,
        avatar_signed_url: null,
      },
      roles: [],
      permissionSnapshot: { allow: [], deny: [] },
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DashboardV2Providers — session-branch hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStoreV2.getState().clear();
    useUserStoreV2.getState().clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  // ── T1: valid sessionStorage branch overrides SSR branch ──────────────────
  it("uses the sessionStorage branch instead of the SSR-derived branch when it is accessible", async () => {
    // Pre-populate sessionStorage with branch-b (user's current working branch
    // in this tab, e.g. they had switched earlier in the same session)
    sessionStorage.setItem(`active-branch:${ORG_ID}`, BRANCH_B.id);

    // SSR-derived context has branch-a (e.g. from DB default_branch_id)
    const context = makeContext({ activeBranchId: BRANCH_A.id, activeBranch: BRANCH_A });

    await act(async () => {
      render(
        <DashboardV2Providers context={context}>
          <div />
        </DashboardV2Providers>
      );
    });

    // Store should reflect the session-local branch, NOT the SSR-derived one
    expect(useAppStoreV2.getState().activeBranchId).toBe(BRANCH_B.id);

    // sessionStorage entry should still be present (not cleared)
    expect(getSessionBranchId(ORG_ID)).toBe(BRANCH_B.id);
  });

  // ── T2: stale sessionStorage entry is cleared; SSR branch initialized ─────
  it("clears a stale sessionStorage entry and falls back to the SSR-derived branch", async () => {
    // Pre-populate sessionStorage with a branch that is no longer accessible
    // (e.g. access was revoked, or branch was deleted)
    sessionStorage.setItem(`active-branch:${ORG_ID}`, BRANCH_C_STALE.id);

    // SSR context does NOT include the stale branch in accessibleBranches
    const context = makeContext({
      activeBranchId: BRANCH_A.id,
      activeBranch: BRANCH_A,
      accessibleBranches: [BRANCH_A, BRANCH_B], // branch-c-stale is absent
    });

    await act(async () => {
      render(
        <DashboardV2Providers context={context}>
          <div />
        </DashboardV2Providers>
      );
    });

    // Store should be on the SSR-derived branch, not the stale one
    expect(useAppStoreV2.getState().activeBranchId).toBe(BRANCH_A.id);

    // sessionStorage must NOT hold the stale entry anymore
    expect(getSessionBranchId(ORG_ID)).not.toBe(BRANCH_C_STALE.id);

    // sessionStorage should have been re-seeded with the SSR branch
    expect(getSessionBranchId(ORG_ID)).toBe(BRANCH_A.id);
  });
});
