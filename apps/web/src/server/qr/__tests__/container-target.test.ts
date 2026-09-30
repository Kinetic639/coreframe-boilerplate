/**
 * @vitest-environment node
 *
 * Phase 10D — `inventory.container` QR target: registry entry (validate /
 * resolverPath / label context) and the public resolver's behaviour for a
 * container token (same branch, accessible cross-branch, inaccessible branch,
 * cross-org). The resolver itself is unchanged; this proves the new registry
 * entry plugs into its existing branch/auth handling.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BranchDataV2 } from "@/lib/stores/v2/app-store";

const ORG_ID = "org-1";
const OTHER_ORG = "org-2";
const QR_ID = "qr-1";
const TOKEN = "AbCdEfGhIjKlMnOpQrSt12";
const CONTAINER_ID = "11111111-1111-4111-8111-111111111111";
const RO_ID = "22222222-2222-4222-8222-222222222222";
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

function makeClient(
  overrides: {
    container?: Record<string, unknown> | null;
    repairOrder?: Record<string, unknown> | null;
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
      data: { target_type: "inventory.container", target_id: CONTAINER_ID, branch_id: BRANCH_B },
    },
    inventory_containers: {
      data:
        overrides.container === undefined
          ? {
              id: CONTAINER_ID,
              organization_id: ORG_ID,
              branch_id: BRANCH_B,
              deleted_at: null,
              code: "K-184213-01",
              reference_type: "repair_order",
              reference_id: RO_ID,
            }
          : overrides.container,
    },
    repair_orders: {
      data:
        overrides.repairOrder === undefined
          ? { zl_number: "184213", vehicle_brand: "Volkswagen" }
          : overrides.repairOrder,
    },
    organizations: { data: { slug: "grupa" } },
    branches: { data: { slug: "cnp-poznan" } },
  };
  return { from: (table: string) => chainable(tables[table] ?? { data: null }) } as never;
}

function branch(id: string): BranchDataV2 {
  return { id, name: id, organization_id: ORG_ID, slug: id, created_at: new Date().toISOString() };
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

import { getTargetDescriptor, isSupportedTargetType } from "../target-registry";
import { resolvePublicQrToken } from "../public-token-resolver";

function dashboardContext(activeBranchId: string, accessible: string[]) {
  return {
    app: { activeBranchId, accessibleBranches: accessible.map(branch) },
    user: { permissionSnapshot: { allow: ["warehouse.inventory.read"], deny: [] } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("inventory.container registry entry", () => {
  const descriptor = getTargetDescriptor("inventory.container")!;

  it("is registered and gated on warehouse inventory permissions", () => {
    expect(isSupportedTargetType("inventory.container")).toBe(true);
    expect(descriptor.requiredAssignPermission).toBe("warehouse.inventory.operate");
    expect(descriptor.requiredReadPermission).toBe("warehouse.inventory.read");
  });

  it("validate: returns the container's own branch for a live container in the org", async () => {
    const result = await descriptor.validate({
      supabase: makeClient(),
      targetId: CONTAINER_ID,
      orgId: ORG_ID,
    });
    expect(result).toEqual({ valid: true, organizationId: ORG_ID, branchId: BRANCH_B });
  });

  it("validate: rejects a container from another organization", async () => {
    const result = await descriptor.validate({
      supabase: makeClient(),
      targetId: CONTAINER_ID,
      orgId: OTHER_ORG,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("WRONG_ORG");
  });

  it("validate: rejects a soft-deleted or missing container", async () => {
    const deleted = await descriptor.validate({
      supabase: makeClient({
        container: {
          id: CONTAINER_ID,
          organization_id: ORG_ID,
          branch_id: BRANCH_B,
          deleted_at: "2026-09-30T00:00:00Z",
        },
      }),
      targetId: CONTAINER_ID,
      orgId: ORG_ID,
    });
    expect(deleted).toMatchObject({ valid: false, error: "SOFT_DELETED" });

    const missing = await descriptor.validate({
      supabase: makeClient({ container: null }),
      targetId: CONTAINER_ID,
      orgId: ORG_ID,
    });
    expect(missing).toMatchObject({ valid: false, error: "NOT_FOUND" });
  });

  it("resolverPath points at the container detail screen", () => {
    expect(descriptor.resolverPath({ targetId: CONTAINER_ID, orgSlug: "grupa" })).toBe(
      `/dashboard/warehouse/containers/${CONTAINER_ID}`
    );
  });

  it("label context shows the container code and its RepairOrder", async () => {
    const label = await descriptor.getLabelContext({
      supabase: makeClient(),
      targetId: CONTAINER_ID,
    });
    expect(label).toEqual({
      primaryText: "K-184213-01",
      secondaryText: "ZL 184213 · Volkswagen",
      tertiaryText: "Kontener",
    });
  });

  it("label context without a RepairOrder omits the secondary line", async () => {
    const label = await descriptor.getLabelContext({
      supabase: makeClient({
        container: {
          id: CONTAINER_ID,
          code: "K-LUZ-01",
          reference_type: null,
          reference_id: null,
        },
      }),
      targetId: CONTAINER_ID,
    });
    expect(label).toEqual({
      primaryText: "K-LUZ-01",
      secondaryText: undefined,
      tertiaryText: "Kontener",
    });
  });
});

describe("resolvePublicQrToken — container token", () => {
  it("same branch: opens the container detail screen", async () => {
    mockCreateServiceClient.mockReturnValue(makeClient());
    mockLoadDashboardContextV2.mockResolvedValue(dashboardContext(BRANCH_B, [BRANCH_B]));

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).toBe(`/dashboard/warehouse/containers/${CONTAINER_ID}`);
      expect(result.targetType).toBe("inventory.container");
    }
  });

  it("accessible other branch: adds the crossBranch confirm hint", async () => {
    mockCreateServiceClient.mockReturnValue(makeClient());
    mockLoadDashboardContextV2.mockResolvedValue(dashboardContext(BRANCH_A, [BRANCH_A, BRANCH_B]));

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).toBe(
        `/dashboard/warehouse/containers/${CONTAINER_ID}?crossBranch=${BRANCH_B}`
      );
    }
  });

  it("inaccessible branch: safe TARGET_NOT_FOUND denial", async () => {
    mockCreateServiceClient.mockReturnValue(makeClient());
    mockLoadDashboardContextV2.mockResolvedValue(dashboardContext(BRANCH_A, [BRANCH_A]));

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result as { error: string }).error).toBe("TARGET_NOT_FOUND");
  });

  it("container of another organization: TARGET_NOT_FOUND", async () => {
    mockCreateServiceClient.mockReturnValue(
      makeClient({
        container: {
          id: CONTAINER_ID,
          organization_id: OTHER_ORG,
          branch_id: BRANCH_B,
          deleted_at: null,
        },
      })
    );
    mockLoadDashboardContextV2.mockResolvedValue(dashboardContext(BRANCH_B, [BRANCH_B]));

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(false);
    if (!result.ok) expect((result as { error: string }).error).toBe("TARGET_NOT_FOUND");
  });

  it("logged-out caller: sent to sign-in with a return to the QR page", async () => {
    mockCreateServiceClient.mockReturnValue(makeClient());
    mockLoadDashboardContextV2.mockResolvedValue(null);

    const result = await resolvePublicQrToken(TOKEN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.redirectPath).toBe(`/sign-in?returnUrl=${encodeURIComponent(`/qr/${TOKEN}`)}`);
    }
  });
});
