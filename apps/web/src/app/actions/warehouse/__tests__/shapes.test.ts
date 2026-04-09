/**
 * @vitest-environment node
 *
 * Unit tests for warehouse shape server actions.
 * All external dependencies mocked — no real DB or auth.
 *
 * Covers:
 *  - Permission deny paths
 *  - Schema validation failures (including label style fields surviving Zod)
 *  - batchSaveShapesAction delegates to WarehouseLayoutShapesService.batchSave
 *  - upsertOneShapeAction delegates to WarehouseLayoutShapesService.upsertOne
 *  - cross-branch location_id error forwarded from service
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { WarehouseLayout, WarehouseLayoutShape } from "@/lib/warehouse/layouts";

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
    getById: vi.fn(),
  },
}));

vi.mock("@/server/services/warehouse-layout-shapes.service", () => ({
  WarehouseLayoutShapesService: {
    listByLayout: vi.fn(),
    batchSave: vi.fn(),
    upsertOne: vi.fn(),
    softDelete: vi.fn(),
  },
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { WarehouseLayoutsService } from "@/server/services/warehouse-layouts.service";
import { WarehouseLayoutShapesService } from "@/server/services/warehouse-layout-shapes.service";
import { batchSaveShapesAction, upsertOneShapeAction, deleteShapeAction } from "../shapes";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORG_ID = "aaaaaaaa-0000-0000-0000-000000000001";
const BRANCH_ID = "bbbbbbbb-0000-0000-0000-000000000002";
const USER_ID = "cccccccc-0000-0000-0000-000000000003";
const LAYOUT_ID = "dddddddd-0000-0000-0000-000000000004";
const SHAPE_ID = "ffffffff-0000-0000-0000-000000000006";
const LOCATION_ID = "eeeeeeee-0000-0000-0000-000000000005";

const ALL_PERMS = [
  "module.warehouse.access",
  "warehouse.read",
  "warehouse.layouts.read",
  "warehouse.layouts.manage",
];

function makeContext(permAllow: string[] = ALL_PERMS) {
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
    root_location_id: null,
    name: "Main",
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

function makeShape(overrides: Partial<WarehouseLayoutShape> = {}): WarehouseLayoutShape {
  return {
    id: SHAPE_ID,
    layout_id: LAYOUT_ID,
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    shape_type: "location",
    location_id: LOCATION_ID,
    label: "A-1",
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    rotation: 0,
    style: null,
    z_index: 0,
    sort_order: 0,
    created_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

/** Minimal valid shape input for batch/upsert */
function makeShapeInput(overrides: Record<string, unknown> = {}) {
  return {
    id: SHAPE_ID,
    shape_type: "location",
    location_id: LOCATION_ID,
    label: "A-1",
    x: 1,
    y: 2,
    width: 3,
    height: 4,
    rotation: 0,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── batchSaveShapesAction ────────────────────────────────────────────────────

describe("batchSaveShapesAction", () => {
  it("denies when missing warehouse.layouts.manage", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["module.warehouse.access", "warehouse.read", "warehouse.layouts.read"]) as any
    );

    const result = await batchSaveShapesAction({
      layout_id: LAYOUT_ID,
      shapes: [],
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns validation error for missing layout_id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    const result = await batchSaveShapesAction({ shapes: [] });
    expect(result.success).toBe(false);
  });

  it("rejects shapes array exceeding 2000 limit", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    const shapes = Array.from({ length: 2001 }, (_, i) =>
      makeShapeInput({ id: `${SHAPE_ID.slice(0, -8)}${String(i).padStart(8, "0")}` })
    );
    const result = await batchSaveShapesAction({ layout_id: LAYOUT_ID, shapes });
    expect(result.success).toBe(false);
  });

  it("rejects layout from different branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout({ branch_id: "other-branch" }),
    });

    const result = await batchSaveShapesAction({ layout_id: LAYOUT_ID, shapes: [] });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain("active branch");
  });

  it("delegates to batchSave service on happy path", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });
    vi.mocked(WarehouseLayoutShapesService.batchSave).mockResolvedValue({
      success: true,
      data: [makeShape()],
    });

    const result = await batchSaveShapesAction({
      layout_id: LAYOUT_ID,
      shapes: [makeShapeInput()],
    });

    expect(WarehouseLayoutShapesService.batchSave).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect((result as { data: unknown[] }).data).toHaveLength(1);
  });

  it("preserves label style fields through schema (regression: Zod stripping)", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });
    vi.mocked(WarehouseLayoutShapesService.batchSave).mockResolvedValue({
      success: true,
      data: [],
    });

    const shapeWithStyle = makeShapeInput({
      style: {
        fill: "#10b981",
        labelColor: "#ffffff",
        labelSize: 0.4,
        labelAlignH: "center",
        labelAlignV: "bottom",
      },
    });

    await batchSaveShapesAction({ layout_id: LAYOUT_ID, shapes: [shapeWithStyle] });

    const callArgs = vi.mocked(WarehouseLayoutShapesService.batchSave).mock.calls[0];
    const savedShapes = callArgs[5]; // shapes param
    expect(savedShapes[0].style).toMatchObject({
      fill: "#10b981",
      labelColor: "#ffffff",
      labelSize: 0.4,
      labelAlignH: "center",
      labelAlignV: "bottom",
    });
  });

  it("forwards cross-branch location error from service", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });
    vi.mocked(WarehouseLayoutShapesService.batchSave).mockResolvedValue({
      success: false,
      error: "One or more shapes reference a location from a different branch",
    });

    const result = await batchSaveShapesAction({
      layout_id: LAYOUT_ID,
      shapes: [makeShapeInput()],
    });

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toContain("different branch");
  });
});

// ─── upsertOneShapeAction ─────────────────────────────────────────────────────

describe("upsertOneShapeAction", () => {
  it("denies when missing warehouse.layouts.manage", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["module.warehouse.access", "warehouse.read", "warehouse.layouts.read"]) as any
    );

    const result = await upsertOneShapeAction({
      layout_id: LAYOUT_ID,
      shape: makeShapeInput(),
    });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("delegates to upsertOne service on happy path", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutsService.getById).mockResolvedValue({
      success: true,
      data: makeLayout(),
    });
    vi.mocked(WarehouseLayoutShapesService.upsertOne).mockResolvedValue({
      success: true,
      data: makeShape(),
    });

    const result = await upsertOneShapeAction({
      layout_id: LAYOUT_ID,
      shape: makeShapeInput(),
    });

    expect(WarehouseLayoutShapesService.upsertOne).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});

// ─── deleteShapeAction ────────────────────────────────────────────────────────

describe("deleteShapeAction", () => {
  it("denies when missing warehouse.layouts.manage", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(
      makeContext(["module.warehouse.access", "warehouse.read", "warehouse.layouts.read"]) as any
    );

    const result = await deleteShapeAction({ id: SHAPE_ID });
    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toBe("Unauthorized");
  });

  it("returns validation error for non-UUID id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    const result = await deleteShapeAction({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("delegates to softDelete service", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext() as any);
    vi.mocked(WarehouseLayoutShapesService.softDelete).mockResolvedValue({
      success: true,
      data: undefined,
    });

    const result = await deleteShapeAction({ id: SHAPE_ID });
    expect(WarehouseLayoutShapesService.softDelete).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
  });
});
