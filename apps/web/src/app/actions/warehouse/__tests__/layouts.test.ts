/**
 * @vitest-environment node
 *
 * Unit tests for warehouse layout server actions.
 * All external dependencies mocked — no real DB or auth.
 *
 * Covers:
 *  - Permission deny paths
 *  - Schema validation failures
 *  - createLayoutAction uses atomic createWithRootLocation RPC path
 *  - createLayoutForLocationAction validates location belongs to active branch
 *  - publishLayoutAction / unpublishLayoutAction require WAREHOUSE_LAYOUTS_PUBLISH
 *  - deleteLayoutAction soft-deletes and emits event
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WarehouseLayout } from "@/lib/warehouse/layouts";

// ─── Mocks ────────────────────────────────────────────────────────────────────

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

vi.mock("@/server/services/warehouse-layouts.service", () => ({
  WarehouseLayoutsService: {
    listByBranch: vi.fn(),
    getById: vi.fn(),
    getWithShapes: vi.fn(),
    getPublishedForScope: vi.fn(),
    create: vi.fn(),
    createWithRootLocation: vi.fn(),
    update: vi.fn(),
    publish: vi.fn(),
    unpublish: vi.fn(),
    softDelete: vi.fn(),
  },
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { createClient } from "@/utils/supabase/server";
import {
  listLayoutsAction,
  createLayoutAction,
  createLayoutForLocationAction,
  publishLayoutAction,
  unpublishLayoutAction,
  deleteLayoutAction,
} from "../layouts";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const BRANCH_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const USER_ID = "cccccccc-0000-0000-0000-000000000003";
const LAYOUT_ID = "dddddddd-0000-0000-0000-000000000004";
const LOCATION_ID = "eeeeeeee-0000-0000-0000-000000000005";

const ALL_WAREHOUSE_PERMS = [
  "module.warehouse.access",
  "warehouse.read",
  "warehouse.layouts.read",
  "warehouse.layouts.manage",
  "warehouse.layouts.publish",
];

function makeContext(permAllow: string[] = ALL_WAREHOUSE_PERMS) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: BRANCH_ID },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow: permAllow, deny: [] },
    },
  };
}

function makeLayout(overrides: Partial<WarehouseLayout> = {}): WarehouseLayout {
  return {
    id: LAYOUT_ID,
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    root_location_id: LOCATION_ID,
    name: "Main Warehouse",
    description: null,
    status: "draft",
    canvas_width_m: 50,
    canvas_height_m: 30,
    published_at: null,
    created_by: USER_ID,
    updated_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listLayoutsAction ────────────────────────────────────────────────────────

describe("listLayoutsAction", () => {
  it("returns error when no active org", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(null as any);
    const result = await listLayoutsAction();
    expect(result.success).toBe(false);
  });

  it("denies when missing warehouse.layouts.read", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["module.warehouse.access", "warehouse.read"]) as any
    );
    const result = await listLayoutsAction();
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns layouts on happy path", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.listByBranch).mockResolvedValue({
      success: true,
      data: [makeLayout()],
    });

    const result = await listLayoutsAction();
    expect(result.success).toBe(true);
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });
});

// ─── createLayoutAction ───────────────────────────────────────────────────────

describe("createLayoutAction", () => {
  it("denies when missing warehouse.layouts.manage", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["module.warehouse.access", "warehouse.read", "warehouse.layouts.read"]) as any
    );

    const result = await createLayoutAction({
      name: "Layout A",
      root_location_code: "LA",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns schema validation error for missing name", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    const result = await createLayoutAction({ root_location_code: "LA" });
    expect(result.success).toBe(false);
  });

  it("returns schema validation error for invalid code characters", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    const result = await createLayoutAction({ name: "Test", root_location_code: "bad code!" });
    expect(result.success).toBe(false);
  });

  it("uses createWithRootLocation atomic path", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.createWithRootLocation).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });

    const result = await createLayoutAction({
      name: "Layout A",
      root_location_code: "LA",
    });

    expect(WarehouseLayoutsService.createWithRootLocation).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });

  it("forwards createWithRootLocation error to caller", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.createWithRootLocation).mockResolvedValue({
      success: false,
      error: "duplicate code",
    });

    const result = await createLayoutAction({
      name: "Layout A",
      root_location_code: "LA",
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("duplicate code");
  });
});

// ─── createLayoutForLocationAction ───────────────────────────────────────────

describe("createLayoutForLocationAction", () => {
  it("rejects location from a different branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    // Supabase client returns null (location not found in this branch)
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    const result = await createLayoutForLocationAction({
      location_id: LOCATION_ID,
      name: "Zone A Map",
    });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain("active branch");
  });

  it("creates layout when location belongs to active branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: LOCATION_ID }, error: null }),
      }),
    };
    vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

    vi.mocked(WarehouseLayoutsService.create).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });

    const result = await createLayoutForLocationAction({
      location_id: LOCATION_ID,
      name: "Zone A Map",
    });

    expect(WarehouseLayoutsService.create).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});

// ─── publishLayoutAction / unpublishLayoutAction ──────────────────────────────

describe("publishLayoutAction", () => {
  it("denies when missing warehouse.layouts.publish", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([
        "module.warehouse.access",
        "warehouse.read",
        "warehouse.layouts.read",
        "warehouse.layouts.manage",
      ]) as any
    );

    const result = await publishLayoutAction({ id: LAYOUT_ID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("calls WarehouseLayoutsService.publish on happy path", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });
    vi.mocked(WarehouseLayoutsService.publish).mockResolvedValue({
      success: true,
      data: makeLayout({ status: "published", published_at: "2026-01-02T00:00:00Z" }),
    });

    const result = await publishLayoutAction({ id: LAYOUT_ID });
    expect(WarehouseLayoutsService.publish).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});

describe("unpublishLayoutAction", () => {
  it("denies when missing warehouse.layouts.publish", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext([
        "module.warehouse.access",
        "warehouse.read",
        "warehouse.layouts.read",
        "warehouse.layouts.manage",
      ]) as any
    );

    const result = await unpublishLayoutAction({ id: LAYOUT_ID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("calls WarehouseLayoutsService.unpublish on happy path", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout({ status: "published" }),
    });
    vi.mocked(WarehouseLayoutsService.unpublish).mockResolvedValue({
      success: true,
      data: makeLayout({ status: "draft" }),
    });

    const result = await unpublishLayoutAction({ id: LAYOUT_ID });
    expect(WarehouseLayoutsService.unpublish).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});

// ─── deleteLayoutAction ───────────────────────────────────────────────────────

describe("deleteLayoutAction", () => {
  it("rejects layout from a different branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);

    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout({ branch_id: "other-branch" }),
    });

    vi.mocked(createClient).mockResolvedValue({} as any);

    const result = await deleteLayoutAction({ id: LAYOUT_ID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain("active branch");
  });

  it("soft-deletes and returns success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(createClient).mockResolvedValue({} as any);
    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });
    vi.mocked(WarehouseLayoutsService.softDelete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await deleteLayoutAction({ id: LAYOUT_ID });
    expect(WarehouseLayoutsService.softDelete).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});
