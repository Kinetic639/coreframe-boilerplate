/**
 * @vitest-environment node
 *
 * Unit tests for warehouse location-group server actions.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@/server/services/warehouse-location-groups.service", () => ({
  WarehouseLocationGroupsService: {
    listByBranch: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    reorderBatch: vi.fn(),
    softDelete: vi.fn(),
  },
}));

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseLocationGroupsService } from "@/server/services/warehouse-location-groups.service";
import {
  createLocationGroupAction,
  updateLocationGroupAction,
  reorderGroupsAction,
  deleteLocationGroupAction,
} from "../location-groups";

const ORG_ID = "org-aaa";
const BRANCH_ID = "branch-bbb";
const USER_ID = "user-ccc";

const FULL_PERMS = [
  "module.warehouse.access",
  "warehouse.read",
  "warehouse.locations.read",
  "warehouse.locations.manage",
];

function makeContext(permAllow: string[] = FULL_PERMS) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: BRANCH_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow: permAllow, deny: [] },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createLocationGroupAction", () => {
  it("delegates to the service using the active branch from context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as never);
    vi.mocked(WarehouseLocationGroupsService.create).mockResolvedValue({
      success: true,
      data: {
        id: "group-1",
        organization_id: ORG_ID,
        branch_id: BRANCH_ID,
        parent_location_id: null,
        name: "Rack bays",
        description: null,
        color: null,
        sort_order: 0,
        created_by: USER_ID,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    });

    const result = await createLocationGroupAction({ name: "Rack bays" });
    expect(result.success).toBe(true);
    expect(WarehouseLocationGroupsService.create).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({ name: "Rack bays" }),
      USER_ID
    );
  });
});

describe("updateLocationGroupAction", () => {
  it("rejects when the group belongs to a different branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as never);
    vi.mocked(WarehouseLocationGroupsService.getById).mockResolvedValue({
      success: true,
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        organization_id: ORG_ID,
        branch_id: "other-branch",
        parent_location_id: null,
        name: "Rack bays",
        description: null,
        color: null,
        sort_order: 0,
        created_by: USER_ID,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    });

    const result = await updateLocationGroupAction({
      id: "11111111-1111-1111-1111-111111111111",
      name: "Updated",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/active branch/i);
  });
});

describe("reorderGroupsAction", () => {
  it("delegates reorder using the active branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as never);
    vi.mocked(WarehouseLocationGroupsService.reorderBatch).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const items = [{ id: "11111111-1111-1111-1111-111111111111", sort_order: 0 }];
    const result = await reorderGroupsAction({ items });
    expect(result.success).toBe(true);
    expect(WarehouseLocationGroupsService.reorderBatch).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      items
    );
  });
});

describe("deleteLocationGroupAction", () => {
  it("rejects when the group belongs to a different branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as never);
    vi.mocked(WarehouseLocationGroupsService.getById).mockResolvedValue({
      success: true,
      data: {
        id: "11111111-1111-1111-1111-111111111111",
        organization_id: ORG_ID,
        branch_id: "other-branch",
        parent_location_id: null,
        name: "Rack bays",
        description: null,
        color: null,
        sort_order: 0,
        created_by: USER_ID,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
        deleted_at: null,
      },
    });

    const result = await deleteLocationGroupAction({
      id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/active branch/i);
  });
});
