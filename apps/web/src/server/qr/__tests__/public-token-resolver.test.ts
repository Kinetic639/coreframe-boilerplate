/**
 * @vitest-environment node
 *
 * Zone 1 / Phase 6 — resolvePublicQrToken's cross-branch flag behavior,
 * CORRECTED 2026-09-24 to close two contract gaps found in review:
 *
 * Correction A: the crossBranch=<targetBranchId> UX hint is now emitted only
 * when the caller actually has access to the target branch (reusing
 * isBranchAccessible(), the exact same check changeBranch() itself uses, via
 * loadDashboardContextV2() — not a bespoke lookup). An inaccessible
 * cross-branch target now returns a safe TARGET_NOT_FOUND denial instead of
 * offering an impossible "switch branch" confirmation.
 *
 * Correction B: a logged-out caller is now redirected to sign-in with a
 * returnUrl pointing back at the qr page itself (/qr/<token>), not at the
 * pre-computed dashboard path — because dashboard/layout.tsx's own returnUrl
 * mechanism only preserves the request pathname (excludes the query string),
 * so the previous behavior would have silently dropped `selected=<id>` (and
 * any crossBranch hint) on the sign-in round trip. Returning to the qr page
 * re-enters this resolver in full under the authenticated context.
 *
 * Does not re-test the pre-existing QR/cross-org validation logic (unchanged,
 * not touched by this phase).
 */

import { describe, it, expect, vi } from "vitest";
import type { BranchDataV2 } from "@/lib/stores/v2/app-store";
import type { PermissionSnapshot } from "@/lib/types/permissions";

const ORG_ID = "org-1";
const QR_ID = "qr-1";
const TOKEN = "AbCdEfGhIjKlMnOpQrSt12";
const LOCATION_ID = "loc-1";
const BRANCH_A = "branch-a";
const BRANCH_B = "branch-b";

type TableResult = { data: unknown; error?: unknown };

function chainable(result: TableResult) {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.is = () => chain;
  chain.maybeSingle = () => Promise.resolve(result);
  return chain;
}

function makeServiceClient(
  overrides: {
    locationBranchId?: string | null;
    locationOrgId?: string;
  } = {}
) {
  const tables: Record<string, TableResult> = {
    qr_codes: {
      data: {
        id: QR_ID,
        token: TOKEN,
        organization_id: ORG_ID,
        status: "active",
        deleted_at: null,
      },
    },
    qr_assignments: {
      data: { target_type: "warehouse.location", target_id: LOCATION_ID, branch_id: null },
    },
    warehouse_locations: {
      data: {
        id: LOCATION_ID,
        organization_id: overrides.locationOrgId ?? ORG_ID,
        branch_id: overrides.locationBranchId ?? BRANCH_B,
        deleted_at: null,
      },
    },
    organizations: { data: { slug: "ambra" } },
    branches: { data: { slug: "warsaw" } },
  };
  return { from: (table: string) => chainable(tables[table] ?? { data: null }) };
}

function branch(id: string): BranchDataV2 {
  return {
    id,
    name: id,
    organization_id: ORG_ID,
    slug: id,
    created_at: new Date().toISOString(),
  };
}

const NO_WILDCARD_SNAPSHOT: PermissionSnapshot = { allow: ["warehouse.locations.read"], deny: [] };
const WILDCARD_SWITCH_SNAPSHOT: PermissionSnapshot = { allow: ["branches.*"], deny: [] };

function makeDashboardContext(options: {
  activeBranchId: string | null;
  accessibleBranches?: BranchDataV2[];
  permissionSnapshot?: PermissionSnapshot;
}) {
  return {
    app: {
      activeBranchId: options.activeBranchId,
      accessibleBranches: options.accessibleBranches ?? [],
    },
    user: {
      permissionSnapshot: options.permissionSnapshot ?? NO_WILDCARD_SNAPSHOT,
    },
  };
}

vi.mock("@/i18n/routing", () => ({
  routing: { pathnames: { "/sign-in": { en: "/sign-in", pl: "/logowanie" } } },
}));

const { mockCreateServiceClient, mockLoadDashboardContextV2 } = vi.hoisted(() => ({
  mockCreateServiceClient: vi.fn(),
  mockLoadDashboardContextV2: vi.fn(),
}));

vi.mock("@/utils/supabase/service", () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: () => mockLoadDashboardContextV2(),
}));

import { resolvePublicQrToken } from "../public-token-resolver";

describe("resolvePublicQrToken — cross-branch deep-link hint (Zone 1 / Phase 6, corrected)", () => {
  it("same branch: no crossBranch hint, target opens directly", async () => {
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_A }));
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({ activeBranchId: BRANCH_A, accessibleBranches: [branch(BRANCH_A)] })
    );

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).toBe(
        `/dashboard/warehouse/locations?selected=${LOCATION_ID}&view=tree`
      );
      expect(result.redirectPath).not.toContain("crossBranch");
    }
  });

  it("accessible cross-branch: adds crossBranch when caller has an accessible-branch assignment for the target branch", async () => {
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({
        activeBranchId: BRANCH_A,
        accessibleBranches: [branch(BRANCH_A), branch(BRANCH_B)],
      })
    );

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).toContain(`selected=${LOCATION_ID}`);
      expect(result.redirectPath).toContain(`crossBranch=${BRANCH_B}`);
    }
  });

  it("accessible cross-branch via wildcard permission: adds crossBranch even without a direct branch assignment", async () => {
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({
        activeBranchId: BRANCH_A,
        accessibleBranches: [branch(BRANCH_A)], // BRANCH_B NOT in accessibleBranches
        permissionSnapshot: WILDCARD_SWITCH_SNAPSHOT, // but caller holds branches.*
      })
    );

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).toContain(`crossBranch=${BRANCH_B}`);
    }
  });

  it("Correction A — inaccessible cross-branch: does NOT add crossBranch, returns safe denial instead of an impossible switch offer", async () => {
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({
        activeBranchId: BRANCH_A,
        accessibleBranches: [branch(BRANCH_A)], // BRANCH_B not accessible, no wildcard
      })
    );

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { error: string }).error).toBe("TARGET_NOT_FOUND");
    }
  });

  it("Correction A — inaccessible cross-branch denial reveals nothing beyond the existing TARGET_NOT_FOUND shape (no distinct error code, no metadata)", async () => {
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({ activeBranchId: BRANCH_A, accessibleBranches: [branch(BRANCH_A)] })
    );

    const result = await resolvePublicQrToken(TOKEN);

    // Same failure shape as a cross-org or soft-deleted target — no new error
    // variant, no branch name/slug/metadata leaked in the result.
    expect(Object.keys(result).sort()).toEqual(["error", "ok", "token"]);
  });

  it("no resolved active branch: no crossBranch, unmodified redirect (safe fallback, unchanged)", async () => {
    mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({ activeBranchId: null, accessibleBranches: [] })
    );

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).not.toContain("crossBranch");
    }
  });

  describe("Correction B — logged-out caller", () => {
    it("redirects to sign-in with a returnUrl pointing back at the qr page itself, not the dashboard target", async () => {
      mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
      mockLoadDashboardContextV2.mockResolvedValue(null);

      const result = await resolvePublicQrToken(TOKEN);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.redirectPath).toBe(
          `/sign-in?returnUrl=${encodeURIComponent(`/qr/${TOKEN}`)}`
        );
        // Must NOT be the pre-computed dashboard path -- that's exactly the
        // query-string-losing shape this correction replaces.
        expect(result.redirectPath).not.toContain("/dashboard/warehouse/locations");
        expect(result.redirectPath).not.toContain("selected=");
      }
    });

    it("localizes the sign-in path and the qr returnUrl target when a locale is provided", async () => {
      mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
      mockLoadDashboardContextV2.mockResolvedValue(null);

      const result = await resolvePublicQrToken(TOKEN, { locale: "pl" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.redirectPath).toBe(
          `/logowanie?returnUrl=${encodeURIComponent(`/pl/qr/${TOKEN}`)}`
        );
      }
    });

    it("the returnUrl is same-origin and safe (starts with '/', never '//') — no open-redirect regression", async () => {
      mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));
      mockLoadDashboardContextV2.mockResolvedValue(null);

      const result = await resolvePublicQrToken(TOKEN);

      expect(result.ok).toBe(true);
      if (result.ok) {
        const url = new URL(result.redirectPath, "http://localhost");
        const returnUrl = url.searchParams.get("returnUrl") ?? "";
        expect(returnUrl.startsWith("/")).toBe(true);
        expect(returnUrl.startsWith("//")).toBe(false);
      }
    });

    it("real auth-return integration: the SAME resolver call, re-invoked after login with the SAME token, correctly re-evaluates branch access under the now-authenticated context", async () => {
      mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));

      // Step 1: anonymous scan -> sign-in redirect (not the dashboard target).
      mockLoadDashboardContextV2.mockResolvedValueOnce(null);
      const anonymousResult = await resolvePublicQrToken(TOKEN);
      expect(anonymousResult.ok).toBe(true);
      if (anonymousResult.ok) {
        expect(anonymousResult.redirectPath).toContain("/sign-in?returnUrl=");
      }

      // Step 2: the returnUrl points back at /qr/<token>, so signInAction's
      // existing, unmodified redirect (tested separately) re-enters this same
      // page, which calls resolvePublicQrToken again -- this time the caller
      // is authenticated with access to the target branch.
      mockLoadDashboardContextV2.mockResolvedValueOnce(
        makeDashboardContext({
          activeBranchId: BRANCH_A,
          accessibleBranches: [branch(BRANCH_A), branch(BRANCH_B)],
        })
      );
      const authenticatedResult = await resolvePublicQrToken(TOKEN);
      expect(authenticatedResult.ok).toBe(true);
      if (authenticatedResult.ok) {
        expect(authenticatedResult.redirectPath).toContain(`selected=${LOCATION_ID}`);
        expect(authenticatedResult.redirectPath).toContain(`crossBranch=${BRANCH_B}`);
      }
    });

    it("real auth-return integration: an inaccessible target reaches safe denial after login, not the dashboard target", async () => {
      mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_B }));

      mockLoadDashboardContextV2.mockResolvedValueOnce(null);
      const anonymousResult = await resolvePublicQrToken(TOKEN);
      expect(anonymousResult.ok).toBe(true);

      mockLoadDashboardContextV2.mockResolvedValueOnce(
        makeDashboardContext({ activeBranchId: BRANCH_A, accessibleBranches: [branch(BRANCH_A)] })
      );
      const authenticatedResult = await resolvePublicQrToken(TOKEN);
      expect(authenticatedResult.ok).toBe(false);
      if (!authenticatedResult.ok) {
        expect((authenticatedResult as { error: string }).error).toBe("TARGET_NOT_FOUND");
      }
    });

    it("real auth-return integration: a same-branch target opens normally after login", async () => {
      mockCreateServiceClient.mockReturnValue(makeServiceClient({ locationBranchId: BRANCH_A }));

      mockLoadDashboardContextV2.mockResolvedValueOnce(null);
      const anonymousResult = await resolvePublicQrToken(TOKEN);
      expect(anonymousResult.ok).toBe(true);

      mockLoadDashboardContextV2.mockResolvedValueOnce(
        makeDashboardContext({ activeBranchId: BRANCH_A, accessibleBranches: [branch(BRANCH_A)] })
      );
      const authenticatedResult = await resolvePublicQrToken(TOKEN);
      expect(authenticatedResult.ok).toBe(true);
      if (authenticatedResult.ok) {
        expect(authenticatedResult.redirectPath).toBe(
          `/dashboard/warehouse/locations?selected=${LOCATION_ID}&view=tree`
        );
        expect(authenticatedResult.redirectPath).not.toContain("crossBranch");
      }
    });
  });

  it("cross-org rejection remains unaffected by the branch-access lookup", async () => {
    mockCreateServiceClient.mockReturnValue(
      makeServiceClient({ locationBranchId: BRANCH_B, locationOrgId: "other-org" })
    );
    mockLoadDashboardContextV2.mockResolvedValue(
      makeDashboardContext({ activeBranchId: BRANCH_A, accessibleBranches: [branch(BRANCH_A)] })
    );

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect((result as { error: string }).error).toBe("TARGET_NOT_FOUND");
    }
    // The branch-access lookup must never run for a target that already
    // failed validation -- confirms no unnecessary context load on a
    // rejected target.
    expect(mockLoadDashboardContextV2).not.toHaveBeenCalled();
  });
});
