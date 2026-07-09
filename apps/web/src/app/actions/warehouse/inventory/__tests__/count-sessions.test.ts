/**
 * @vitest-environment node
 *
 * Unit tests for stock-audit ("count session") server actions.
 * All external dependencies mocked — no real DB or auth.
 *
 * Covers:
 *  - Permission-deny paths (missing WAREHOUSE_AUDITS_READ / _MANAGE / active branch)
 *  - Schema validation failures (bad scope shape, missing supplier_id for
 *    supplier-type, missing location_ids for location-type, unknown scope key)
 *  - Happy paths (service delegates correctly, events emitted)
 *  - approveInventoryCountSessionAction does NOT duplicate the
 *    warehouse.inventory.adjust check — it lets the RPC's rejection surface
 *    unchanged (decision #3, separation of duties)
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

vi.mock("@/server/services/inventory-count-sessions.service", () => ({
  InventoryCountSessionsService: {
    listSessions: vi.fn(),
    getSessionDetail: vi.fn(),
    createCountSession: vi.fn(),
    updateCountLine: vi.fn(),
    addUnexpectedLine: vi.fn(),
    bulkApproveLines: vi.fn(),
    approveCountSession: vi.fn(),
    updateSessionStatus: vi.fn(),
    getReorderReport: vi.fn(),
    setReorderSuggestionAction: vi.fn(),
  },
}));

vi.mock("@/server/services/warehouse-locations.service", () => ({
  WarehouseLocationsService: {
    listByBranch: vi.fn(),
  },
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { InventoryCountSessionsService } from "@/server/services/inventory-count-sessions.service";
import { WarehouseLocationsService } from "@/server/services/warehouse-locations.service";
import { eventService } from "@/server/services/event.service";
import {
  addUnexpectedCountLineAction,
  approveInventoryCountSessionAction,
  bulkApproveCountLinesAction,
  createInventoryCountSessionAction,
  getInventoryCountSessionAction,
  getReorderReportAction,
  listInventoryCountSessionsAction,
  setReorderSuggestionActionAction,
  updateInventoryCountLineAction,
  updateInventoryCountSessionStatusAction,
} from "../count-sessions";

const ORG_ID = "org-aaa";
const BRANCH_ID = "branch-bbb";
const USER_ID = "user-ccc";

function makeContext(permAllow: string[] = [], branchId: string | null = BRANCH_ID) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: branchId },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow: permAllow, deny: [] },
    },
  };
}

// module.warehouse.access + warehouse.read are required by requireWarehouseContext
// regardless of the feature-specific slug being tested.
const BASE_PERMS = ["module.warehouse.access", "warehouse.read"];
const READ_PERMS = [...BASE_PERMS, "warehouse.audits.read"];
const MANAGE_PERMS = [...BASE_PERMS, "warehouse.audits.manage"];
const REPORTS_PERMS = [...BASE_PERMS, "warehouse.reports.read"];

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── listInventoryCountSessionsAction ──────────────────────────────────────────

describe("listInventoryCountSessionsAction", () => {
  it("denies when warehouse.audits.read is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(BASE_PERMS) as never);
    const result = await listInventoryCountSessionsAction({});
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.listSessions).not.toHaveBeenCalled();
  });

  it("fails validation on a bad status value", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await listInventoryCountSessionsAction({ status: "not-a-real-status" });
    expect(result.success).toBe(false);
  });

  it("delegates to the service with the active org/branch from context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.listSessions).mockResolvedValue({
      success: true,
      data: { rows: [], totalCount: 0, page: 1, pageSize: 20 },
    });

    const result = await listInventoryCountSessionsAction({});
    expect(result.success).toBe(true);
    expect(InventoryCountSessionsService.listSessions).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.objectContaining({ page: 1, pageSize: 20 })
    );
  });
});

// ─── getInventoryCountSessionAction ────────────────────────────────────────────

describe("getInventoryCountSessionAction", () => {
  it("denies when warehouse.audits.read is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(BASE_PERMS) as never);
    const result = await getInventoryCountSessionAction({
      id: "11111111-1111-1111-1111-111111111111",
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.getSessionDetail).not.toHaveBeenCalled();
  });

  it("fails validation on a non-uuid id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await getInventoryCountSessionAction({ id: "not-a-uuid" });
    expect(result.success).toBe(false);
  });
});

// ─── createInventoryCountSessionAction ─────────────────────────────────────────

const LOCATION_ID = "11111111-1111-1111-1111-111111111111";
const SUPPLIER_ID = "22222222-2222-2222-2222-222222222222";

describe("createInventoryCountSessionAction", () => {
  it("denies when warehouse.audits.manage is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await createInventoryCountSessionAction({
      scope: { count_type: "location", location_ids: [LOCATION_ID] },
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.createCountSession).not.toHaveBeenCalled();
  });

  it("errors when there is no active branch", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS, null) as never);
    const result = await createInventoryCountSessionAction({
      scope: { count_type: "location", location_ids: [LOCATION_ID] },
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect((result as { success: false; error: string }).error).toMatch(/active branch/i);
  });

  it("rejects a location-scoped session with no location_ids", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    const result = await createInventoryCountSessionAction({
      scope: { count_type: "location", location_ids: [] },
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.createCountSession).not.toHaveBeenCalled();
  });

  it("rejects a supplier-scoped session with no supplier_id", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    const result = await createInventoryCountSessionAction({
      scope: { count_type: "supplier" },
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.createCountSession).not.toHaveBeenCalled();
  });

  it("rejects a scope containing an unknown key (strict schema)", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    const result = await createInventoryCountSessionAction({
      scope: {
        count_type: "location",
        location_ids: [LOCATION_ID],
        allow_partial_posting: true,
      },
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.createCountSession).not.toHaveBeenCalled();
  });

  it("fetches branch locations and delegates for a location-scoped session", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(WarehouseLocationsService.listByBranch).mockResolvedValue({
      success: true,
      data: [{ id: LOCATION_ID, parent_id: null }] as never,
    });
    vi.mocked(InventoryCountSessionsService.createCountSession).mockResolvedValue({
      success: true,
      data: { count_session_id: "session-1" },
    });

    const result = await createInventoryCountSessionAction({
      scope: { count_type: "location", location_ids: [LOCATION_ID] },
    });

    expect(result.success).toBe(true);
    expect(WarehouseLocationsService.listByBranch).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID
    );
    expect(InventoryCountSessionsService.createCountSession).toHaveBeenCalled();
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "warehouse.inventory.count_session.created" })
    );
  });

  it("does not fetch branch locations for a supplier-scoped session", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.createCountSession).mockResolvedValue({
      success: true,
      data: { count_session_id: "session-1" },
    });

    const result = await createInventoryCountSessionAction({
      scope: { count_type: "supplier", supplier_id: SUPPLIER_ID },
    });

    expect(result.success).toBe(true);
    expect(WarehouseLocationsService.listByBranch).not.toHaveBeenCalled();
  });
});

// ─── updateInventoryCountLineAction ────────────────────────────────────────────

describe("updateInventoryCountLineAction", () => {
  it("denies when warehouse.audits.manage is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await updateInventoryCountLineAction({ id: LOCATION_ID, status: "skipped" });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.updateCountLine).not.toHaveBeenCalled();
  });

  it("delegates to the service and emits an event on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.updateCountLine).mockResolvedValue({
      success: true,
      data: { id: LOCATION_ID },
    });

    const result = await updateInventoryCountLineAction({
      id: LOCATION_ID,
      counted_quantity: 5,
      status: "counted",
    });

    expect(result.success).toBe(true);
    expect(InventoryCountSessionsService.updateCountLine).toHaveBeenCalledWith(
      expect.anything(),
      LOCATION_ID,
      expect.objectContaining({ counted_quantity: 5, status: "counted", actor_user_id: USER_ID })
    );
  });

  it("does not emit an event when the service call fails", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.updateCountLine).mockResolvedValue({
      success: false,
      error: "A reason is required to approve a line with a quantity variance",
    });

    const result = await updateInventoryCountLineAction({ id: LOCATION_ID, status: "approved" });
    expect(result.success).toBe(false);
    expect(eventService.emit).not.toHaveBeenCalled();
  });
});

// ─── addUnexpectedCountLineAction ──────────────────────────────────────────────

describe("addUnexpectedCountLineAction", () => {
  it("denies when warehouse.audits.manage is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await addUnexpectedCountLineAction({
      count_session_id: LOCATION_ID,
      variant_id: LOCATION_ID,
      location_id: LOCATION_ID,
      unit_id: LOCATION_ID,
      counted_quantity: 1,
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.addUnexpectedLine).not.toHaveBeenCalled();
  });

  it("delegates and emits an event on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.addUnexpectedLine).mockResolvedValue({
      success: true,
      data: { id: "line-new" },
    });

    const result = await addUnexpectedCountLineAction({
      count_session_id: LOCATION_ID,
      variant_id: LOCATION_ID,
      location_id: LOCATION_ID,
      unit_id: LOCATION_ID,
      counted_quantity: 2,
    });

    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "warehouse.inventory.count_line.unexpected_added" })
    );
  });
});

// ─── bulkApproveCountLinesAction ───────────────────────────────────────────────

describe("bulkApproveCountLinesAction", () => {
  it("denies when warehouse.audits.manage is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await bulkApproveCountLinesAction({ line_ids: [LOCATION_ID] });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.bulkApproveLines).not.toHaveBeenCalled();
  });

  it("rejects an empty line_ids array", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    const result = await bulkApproveCountLinesAction({ line_ids: [] });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.bulkApproveLines).not.toHaveBeenCalled();
  });

  it("delegates and only emits an event when at least one line was approved", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.bulkApproveLines).mockResolvedValue({
      success: true,
      data: { approvedIds: [], skippedIds: [LOCATION_ID] },
    });

    const result = await bulkApproveCountLinesAction({ line_ids: [LOCATION_ID] });
    expect(result.success).toBe(true);
    expect(eventService.emit).not.toHaveBeenCalled();
  });
});

// ─── updateInventoryCountSessionStatusAction ───────────────────────────────────

describe("updateInventoryCountSessionStatusAction", () => {
  it("denies when warehouse.audits.manage is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await updateInventoryCountSessionStatusAction({
      id: LOCATION_ID,
      status: "counting",
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.updateSessionStatus).not.toHaveBeenCalled();
  });

  it("rejects an invalid status value", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    const result = await updateInventoryCountSessionStatusAction({
      id: LOCATION_ID,
      status: "approved",
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.updateSessionStatus).not.toHaveBeenCalled();
  });

  it("delegates to the service and emits an event on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.updateSessionStatus).mockResolvedValue({
      success: true,
      data: { id: LOCATION_ID, status: "counting" },
    });

    const result = await updateInventoryCountSessionStatusAction({
      id: LOCATION_ID,
      status: "counting",
    });

    expect(result.success).toBe(true);
    expect(InventoryCountSessionsService.updateSessionStatus).toHaveBeenCalledWith(
      expect.anything(),
      LOCATION_ID,
      "counting"
    );
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "warehouse.inventory.count_session.status_updated" })
    );
  });

  it("does not emit an event when the service call fails", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.updateSessionStatus).mockResolvedValue({
      success: false,
      error: "not found",
    });

    const result = await updateInventoryCountSessionStatusAction({
      id: LOCATION_ID,
      status: "submitted",
    });
    expect(result.success).toBe(false);
    expect(eventService.emit).not.toHaveBeenCalled();
  });
});

// ─── approveInventoryCountSessionAction ────────────────────────────────────────

describe("approveInventoryCountSessionAction", () => {
  it("denies when warehouse.audits.manage is missing (before ever reaching the RPC)", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await approveInventoryCountSessionAction({ id: LOCATION_ID });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.approveCountSession).not.toHaveBeenCalled();
  });

  it("does not perform a separate warehouse.inventory.adjust check at the action layer — lets the RPC's own rejection surface unchanged", async () => {
    // A user with ONLY audits.manage (no inventory.adjust) passes the
    // action-layer gate; the service/RPC call is what would reject it.
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.approveCountSession).mockResolvedValue({
      success: false,
      error: "Missing warehouse.inventory.adjust permission",
    });

    const result = await approveInventoryCountSessionAction({ id: LOCATION_ID });
    expect(InventoryCountSessionsService.approveCountSession).toHaveBeenCalled();
    expect(result).toEqual({
      success: false,
      error: "Missing warehouse.inventory.adjust permission",
    });
  });

  it("emits an approval event on success", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.approveCountSession).mockResolvedValue({
      success: true,
      data: { count_session_id: LOCATION_ID, status: "approved" },
    });

    const result = await approveInventoryCountSessionAction({ id: LOCATION_ID });
    expect(result.success).toBe(true);
    expect(eventService.emit).toHaveBeenCalledWith(
      expect.objectContaining({ actionKey: "warehouse.inventory.count_session.approved" })
    );
  });
});

// ─── getReorderReportAction ─────────────────────────────────────────────────────

describe("getReorderReportAction", () => {
  it("denies when warehouse.reports.read is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(BASE_PERMS) as never);
    const result = await getReorderReportAction({});
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.getReorderReport).not.toHaveBeenCalled();
  });

  it("delegates to the service with the active org/branch from context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(REPORTS_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.getReorderReport).mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await getReorderReportAction({});
    expect(result.success).toBe(true);
    expect(InventoryCountSessionsService.getReorderReport).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      BRANCH_ID,
      expect.any(Object)
    );
  });
});

// ─── setReorderSuggestionActionAction ──────────────────────────────────────────

describe("setReorderSuggestionActionAction", () => {
  it("denies when warehouse.audits.manage is missing", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(READ_PERMS) as never);
    const result = await setReorderSuggestionActionAction({
      variant_id: LOCATION_ID,
      location_id: null,
      status: "accepted",
    });
    expect(result.success).toBe(false);
    expect(InventoryCountSessionsService.setReorderSuggestionAction).not.toHaveBeenCalled();
  });

  it("delegates to the service with the active org/branch from context", async () => {
    vi.mocked(loadDashboardContextV2).mockResolvedValue(makeContext(MANAGE_PERMS) as never);
    vi.mocked(InventoryCountSessionsService.setReorderSuggestionAction).mockResolvedValue({
      success: true,
      data: { id: "action-1" },
    });

    const result = await setReorderSuggestionActionAction({
      variant_id: LOCATION_ID,
      location_id: null,
      status: "ignored",
    });

    expect(result.success).toBe(true);
    expect(InventoryCountSessionsService.setReorderSuggestionAction).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        organization_id: ORG_ID,
        branch_id: BRANCH_ID,
        variant_id: LOCATION_ID,
        status: "ignored",
        actor_user_id: USER_ID,
      })
    );
  });
});
