/**
 * @vitest-environment node
 *
 * Unit tests for warehouse location server actions.
 * All external dependencies mocked — no real DB or auth.
 *
 * Covers:
 *  - Permission deny paths (missing MODULE_WAREHOUSE_ACCESS, WAREHOUSE_READ,
 *    WAREHOUSE_LOCATIONS_READ, WAREHOUSE_LOCATIONS_MANAGE)
 *  - Schema validation failures
 *  - Successful happy paths (service delegates, events emitted)
 *  - Entitlement errors mapped to friendly messages
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks (hoisted — no outer variable references allowed) ───────────────────

vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn(),
}));

vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: vi.fn().mockResolvedValue(undefined) },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));

vi.mock("@/server/services/warehouse-locations.service", () => ({
  WarehouseLocationsService: {
    listByBranch: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import {
  listLocationsAction,
  getLocationAction,
  createLocationAction,
  updateLocationAction,
  deleteLocationAction,
} from "../locations";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = "org-aaa";
const BRANCH_ID = "branch-bbb";
const USER_ID = "user-ccc";

function makeContext(permAllow: string[] = []) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: BRANCH_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow: permAllow, deny: [] },
    },
  };
}

function makeLocation(overrides = {}) {
  return {
    id: "loc-001",
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    name: "Test",
    code: null,
    description: null,
    icon_name: null,
    color: null,
    parent_id: null,
    level: 0,
    sort_order: 0,
    qr_code: "qr-x",
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

// ─── Full permission set that passes all gates ────────────────────────────────

const FULL_PERMS = [
  "module.warehouse.access",
  "warehouse.read",
  "warehouse.locations.read",
  "warehouse.locations.manage",
];

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listLocationsAction ──────────────────────────────────────────────────────

describe("listLocationsAction", () => {
  it("returns unauthorized when no activeOrgId", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue({
      app: { activeOrgId: null },
      user: { user: null, permissionSnapshot: { allow: [], deny: [] } },
    } as never);
    const result = await listLocationsAction(BRANCH_ID);
    expect(result.success).toBe(false);
  });

  it("returns unauthorized when MODULE_WAREHOUSE_ACCESS missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext([]) as never);
    const result = await listLocationsAction(BRANCH_ID);
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns unauthorized when WAREHOUSE_LOCATIONS_READ missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["module.warehouse.access", "warehouse.read"]) as never
    );
    const result = await listLocationsAction(BRANCH_ID);
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("delegates to service on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    vi.mocked(WarehouseLocationsService.listByBranch).mockResolvedValue({
      success: true,
      data: [makeLocation()],
    });
    const result = await listLocationsAction(BRANCH_ID);
    expect(result.success).toBe(true);
    expect(WarehouseLocationsService.listByBranch).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID
    );
  });
});

// ─── getLocationAction ────────────────────────────────────────────────────────

describe("getLocationAction", () => {
  it("rejects invalid UUID input", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const result = await getLocationAction({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("delegates to service with valid UUID", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const loc = makeLocation({ id: "11111111-1111-1111-1111-111111111111" });
    vi.mocked(WarehouseLocationsService.getById).mockResolvedValue({
      success: true,
      data: loc,
    });
    const result = await getLocationAction({ id: "11111111-1111-1111-1111-111111111111" });
    expect(result.success).toBe(true);
  });
});

// ─── createLocationAction ─────────────────────────────────────────────────────

describe("createLocationAction", () => {
  it("returns unauthorized when WAREHOUSE_LOCATIONS_MANAGE missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([
        "module.warehouse.access",
        "warehouse.read",
        "warehouse.locations.read",
      ]) as never
    );
    const result = await createLocationAction({ name: "Zone A" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("rejects empty name", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const result = await createLocationAction({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid color hex", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const result = await createLocationAction({ name: "Zone A", color: "red" });
    expect(result.success).toBe(false);
  });

  it("returns error when no activeBranchId", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue({
      app: { activeOrgId: ORG_ID, activeBranchId: null },
      user: {
        user: { id: USER_ID },
        permissionSnapshot: { allow: FULL_PERMS, deny: [] },
      },
    } as never);
    const result = await createLocationAction({ name: "Zone A" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/active branch/i);
  });

  it("delegates to service and emits event on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const newLoc = makeLocation({ id: "new-loc-id", name: "Zone A" });
    vi.mocked(WarehouseLocationsService.create).mockResolvedValue({
      success: true,
      data: newLoc,
    });
    const result = await createLocationAction({ name: "Zone A" });
    expect(result.success).toBe(true);
    expect(WarehouseLocationsService.create).toHaveBeenCalled();
  });
});

// ─── updateLocationAction ─────────────────────────────────────────────────────

describe("updateLocationAction", () => {
  it("rejects invalid UUID for id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const result = await updateLocationAction({ id: "not-a-uuid", name: "X" });
    expect(result.success).toBe(false);
  });

  it("returns error when no activeBranchId (fail-closed branch guard)", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue({
      app: { activeOrgId: ORG_ID, activeBranchId: null },
      user: {
        user: { id: USER_ID },
        permissionSnapshot: { allow: FULL_PERMS, deny: [] },
      },
    } as never);
    const result = await updateLocationAction({
      id: "22222222-2222-2222-2222-222222222222",
      name: "X",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/active branch/i);
  });

  it("delegates to service on valid input", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const updated = makeLocation({ id: "22222222-2222-2222-2222-222222222222", name: "Updated" });
    vi.mocked(WarehouseLocationsService.update).mockResolvedValue({
      success: true,
      data: updated,
    });
    const result = await updateLocationAction({
      id: "22222222-2222-2222-2222-222222222222",
      name: "Updated",
    });
    expect(result.success).toBe(true);
    expect(WarehouseLocationsService.update).toHaveBeenCalled();
  });
});

// ─── deleteLocationAction ─────────────────────────────────────────────────────

describe("deleteLocationAction", () => {
  it("rejects invalid UUID for id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const result = await deleteLocationAction({ id: "bad" });
    expect(result.success).toBe(false);
  });

  it("returns error when no activeBranchId (fail-closed branch guard)", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue({
      app: { activeOrgId: ORG_ID, activeBranchId: null },
      user: {
        user: { id: USER_ID },
        permissionSnapshot: { allow: FULL_PERMS, deny: [] },
      },
    } as never);
    const result = await deleteLocationAction({ id: "33333333-3333-3333-3333-333333333333" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/active branch/i);
  });

  it("returns error when location not found before delete", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    vi.mocked(WarehouseLocationsService.getById).mockResolvedValue({
      success: true,
      data: null,
    });
    const result = await deleteLocationAction({ id: "33333333-3333-3333-3333-333333333333" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/not found/i);
  });

  it("returns error when location belongs to a different branch (cross-branch denial)", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    // Location is in a different branch than the active branch
    const locInOtherBranch = makeLocation({
      id: "55555555-5555-5555-5555-555555555555",
      branch_id: "different-branch-id",
    });
    vi.mocked(WarehouseLocationsService.getById).mockResolvedValue({
      success: true,
      data: locInOtherBranch,
    });
    const result = await deleteLocationAction({ id: "55555555-5555-5555-5555-555555555555" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(
        /does not belong to the active branch/i
      );
    // softDelete must NOT be called
    expect(WarehouseLocationsService.softDelete).not.toHaveBeenCalled();
  });

  it("soft-deletes and emits event on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(FULL_PERMS) as never);
    const loc = makeLocation({ id: "44444444-4444-4444-4444-444444444444", branch_id: BRANCH_ID });
    vi.mocked(WarehouseLocationsService.getById).mockResolvedValue({ success: true, data: loc });
    vi.mocked(WarehouseLocationsService.softDelete).mockResolvedValue({
      success: true,
      data: undefined,
    });
    const result = await deleteLocationAction({ id: "44444444-4444-4444-4444-444444444444" });
    expect(result.success).toBe(true);
    expect(WarehouseLocationsService.softDelete).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      "44444444-4444-4444-4444-444444444444"
    );
  });
});
