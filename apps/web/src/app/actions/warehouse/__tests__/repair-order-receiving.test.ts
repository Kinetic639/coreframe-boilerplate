import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * Zone 5 Phase 4/5/6 -- action-level tests (external review correction:
 * "no action-level tests" previously). Covers permission gating, error
 * normalization (allowlisted vs unexpected DB errors, never leaking raw
 * SQL/relation/function names or provenance details), and success paths --
 * without touching a real database (the auth/context layer and the
 * Supabase client are both mocked).
 */

const requireWarehouseContext = vi.fn();
const hasPermission = vi.fn();
const requireActiveBranch = vi.fn();
const userIdFrom = vi.fn();
const mapUnexpected = vi.fn((_e: unknown) => ({
  success: false as const,
  error: "Unexpected error",
}));

vi.mock("../inventory/action-context", () => ({
  requireWarehouseContext: () => requireWarehouseContext(),
  hasPermission: (...args: unknown[]) => hasPermission(...args),
  requireActiveBranch: (...args: unknown[]) => requireActiveBranch(...args),
  userIdFrom: (...args: unknown[]) => userIdFrom(...args),
  mapUnexpected: (e: unknown) => mapUnexpected(e),
}));

const rpcMock = vi.fn();
vi.mock("@/utils/supabase/server", () => ({
  createClient: async () => ({ rpc: rpcMock }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getStorageSuggestions = vi.fn();
vi.mock("@/server/services/repair-order-storage.service", () => ({
  RepairOrderStorageService: {
    getStorageSuggestions: (...args: unknown[]) => getStorageSuggestions(...args),
  },
}));

import {
  receiveRepairOrderStockAction,
  putawayRepairOrderStockAction,
  getRepairOrderStorageSuggestionsAction,
} from "../repair-order-receiving";

function mockAuthOk() {
  requireWarehouseContext.mockResolvedValue({
    success: true,
    context: {
      app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
      user: { user: { id: "user-1" } },
    },
  });
  hasPermission.mockReturnValue(true);
  requireActiveBranch.mockReturnValue({ success: true, branchId: "branch-1" });
  userIdFrom.mockReturnValue("user-1");
}

const validLine = {
  variant_id: "11111111-1111-1111-1111-111111111111",
  unit_id: "22222222-2222-2222-2222-222222222222",
  quantity: 1,
};

describe("receiveRepairOrderStockAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
  });

  it("rejects when the caller lacks warehouse.inventory.operate/adjust", async () => {
    hasPermission.mockReturnValue(false);
    const result = await receiveRepairOrderStockAction({ lines: [validLine] });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects invalid input before ever calling the RPC", async () => {
    const result = await receiveRepairOrderStockAction({ lines: [] });
    expect(result.success).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("A. maps an allowlisted, known DB error through as-is (safe, deliberate message)", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "P0002",
        message:
          "No active receiving location configured for this branch (organization_id=org-1, branch_id=branch-1). An admin must designate one on the Locations page before receiving can post.",
      },
    });
    const result = await receiveRepairOrderStockAction({ lines: [validLine] });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).toContain("No active receiving location configured");
  });

  it("B. the SAME SQLSTATE with a DIFFERENT (unrecognized) message is NOT leaked -- falls back to the generic message", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      // Same code (P0002) as an allowlisted entry, but a message that does
      // not match that entry's pattern -- must not be passed through.
      error: {
        code: "P0002",
        message: 'relation "inventory_secret_internal_table" does not exist',
      },
    });
    const result = await receiveRepairOrderStockAction({ lines: [validLine] });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).not.toContain("inventory_secret_internal_table");
    expect(result.error).toContain("unexpected server error");
  });

  it("C. a completely unexpected DB error/code is never leaked to the client", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "XX000",
        message:
          'duplicate key value violates unique constraint "repair_order_line_locations_pkey" DETAIL: Key (id)=(...) already exists.',
      },
    });
    const result = await receiveRepairOrderStockAction({ lines: [validLine] });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).not.toContain("repair_order_line_locations_pkey");
    expect(result.error).not.toContain("duplicate key");
    expect(result.error).toBe(
      "Receiving failed due to an unexpected server error. Please try again or contact support."
    );
  });

  it("succeeds and calls the RPC with the expected shape, including source_line_id passthrough", async () => {
    rpcMock.mockResolvedValue({
      data: { movement_id: "m-1", document_number: "PZ/1" },
      error: null,
    });
    const result = await receiveRepairOrderStockAction({
      lines: [{ ...validLine, source_line_id: "33333333-3333-3333-3333-333333333333" }],
    });
    expect(result).toEqual({
      success: true,
      data: { movement_id: "m-1", document_number: "PZ/1" },
    });
    expect(rpcMock).toHaveBeenCalledWith(
      "receive_repair_order_stock",
      expect.objectContaining({
        p_organization_id: "org-1",
        p_branch_id: "branch-1",
        p_actor_user_id: "user-1",
        p_lines: [
          expect.objectContaining({ source_line_id: "33333333-3333-3333-3333-333333333333" }),
        ],
      })
    );
  });
});

describe("putawayRepairOrderStockAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
  });

  const validPutawayLine = {
    repair_order_line_id: "44444444-4444-4444-4444-444444444444",
    ...validLine,
  };

  it("rejects when the caller lacks permission", async () => {
    hasPermission.mockReturnValue(false);
    const result = await putawayRepairOrderStockAction({
      lines: [validPutawayLine],
      destination_location_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(result).toEqual({ success: false, error: "Unauthorized" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("known error (insufficient attributed quantity) passes through as-is", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "22023",
        message:
          "Line 1 requests 999 but only 3 is currently attributed to this RepairOrderLine at the receiving location",
      },
    });
    const result = await putawayRepairOrderStockAction({
      lines: [validPutawayLine],
      destination_location_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).toContain("only 3 is currently attributed");
  });

  it("unexpected error is replaced with a generic, non-leaking message", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: 'column "secret_internal_column" of relation does not exist',
      },
    });
    const result = await putawayRepairOrderStockAction({
      lines: [validPutawayLine],
      destination_location_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).not.toContain("secret_internal_column");
    expect(result.error).toBe(
      "Putaway failed due to an unexpected server error. Please try again or contact support."
    );
  });

  it("known error (UNKNOWN-source rejection, external review third pass) passes through as-is", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "55000",
        message:
          "Line 1: the receiving location's attribution for this variant is UNKNOWN (a prior generic movement made it ambiguous) -- putaway is not permitted until it is reconciled",
      },
    });
    const result = await putawayRepairOrderStockAction({
      lines: [validPutawayLine],
      destination_location_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).toContain("attribution for this variant is UNKNOWN");
  });

  it("the SAME SQLSTATE (55000) with a DIFFERENT, unrecognized message is NOT leaked -- falls back to the generic message", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { code: "55000", message: "some unrelated 55000 error from elsewhere in the schema" },
    });
    const result = await putawayRepairOrderStockAction({
      lines: [validPutawayLine],
      destination_location_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).not.toContain("unrelated 55000 error");
    expect(result.error).toBe(
      "Putaway failed due to an unexpected server error. Please try again or contact support."
    );
  });

  it("succeeds and posts one document for one destination", async () => {
    rpcMock.mockResolvedValue({
      data: { movement_id: "m-2", document_number: "MM/1" },
      error: null,
    });
    const result = await putawayRepairOrderStockAction({
      lines: [validPutawayLine],
      destination_location_id: "55555555-5555-5555-5555-555555555555",
    });
    expect(result).toEqual({
      success: true,
      data: { movement_id: "m-2", document_number: "MM/1" },
    });
  });
});

describe("getRepairOrderStorageSuggestionsAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthOk();
  });

  it("normalizes an unexpected read-model error, never leaking raw Supabase text", async () => {
    getStorageSuggestions.mockResolvedValue({
      success: false,
      error: 'relation "repair_order_line_locations_typo" does not exist',
    });
    const result = await getRepairOrderStorageSuggestionsAction({
      repair_order_id: "66666666-6666-6666-6666-666666666666",
    });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).not.toContain("repair_order_line_locations_typo");
  });

  it("passes through a recognizable RLS/permission denial as a safe generic statement", async () => {
    getStorageSuggestions.mockResolvedValue({
      success: false,
      error: "permission denied for table repair_order_line_locations",
    });
    const result = await getRepairOrderStorageSuggestionsAction({
      repair_order_id: "66666666-6666-6666-6666-666666666666",
    });
    expect(result.success).toBe(false);
    if (result.success === true) return;
    expect(result.error).toBe("You do not have permission to view this data.");
  });

  it("returns suggestions on success", async () => {
    getStorageSuggestions.mockResolvedValue({ success: true, data: [] });
    const result = await getRepairOrderStorageSuggestionsAction({
      repair_order_id: "66666666-6666-6666-6666-666666666666",
    });
    expect(result).toEqual({ success: true, data: [] });
  });
});
