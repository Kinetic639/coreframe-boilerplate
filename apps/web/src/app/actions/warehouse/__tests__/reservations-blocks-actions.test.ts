/**
 * @vitest-environment node
 *
 * Stages E4/E5 — reservation and block actions: writes need
 * warehouse.inventory.operate, input is validated, and org / branch / actor
 * always come from the server context (never from the client).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  allow: ["warehouse.inventory.read", "warehouse.inventory.operate"] as string[],
  reserve: vi.fn(),
  release: vi.fn(),
  block: vi.fn(),
  issue: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({ createClient: vi.fn().mockResolvedValue({}) }));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn().mockImplementation(async () => ({
    app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
    user: { user: { id: "user-1" }, permissionSnapshot: { allow: h.allow, deny: [] } },
  })),
}));
vi.mock("@/server/services/inventory-reservations.service", () => ({
  InventoryReservationsService: {
    reserveForRepairOrder: (...a: unknown[]) => h.reserve(...a),
    releaseLines: (...a: unknown[]) => h.release(...a),
  },
}));
vi.mock("@/server/services/inventory-blocks.service", () => ({
  BLOCK_REASON_CODES: [
    "quality_check",
    "supplier_complaint",
    "damaged",
    "delivery_mismatch",
    "other",
  ],
  InventoryBlocksService: {
    block: (...a: unknown[]) => h.block(...a),
    issue: (...a: unknown[]) => h.issue(...a),
  },
}));

import { releaseReservationLinesAction, reserveForRepairOrderAction } from "../reservations";
import { blockStockAction, issueBlockedStockAction } from "../blocks";

const RO = "11111111-1111-4111-8111-111111111111";
const ROL = "22222222-2222-4222-8222-222222222222";
const LOC = "33333333-3333-4333-8333-333333333333";
const RL = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  vi.clearAllMocks();
  h.allow = ["warehouse.inventory.read", "warehouse.inventory.operate"];
  h.reserve.mockResolvedValue({ success: true, data: { reservationId: "r1" } });
  h.release.mockResolvedValue({ success: true, data: { releasedQuantity: 1 } });
  h.block.mockResolvedValue({ success: true, data: { blockId: "b1" } });
  h.issue.mockResolvedValue({ success: true, data: { movementId: "m1" } });
});

describe("reservation actions", () => {
  it("reserve takes org, branch and actor from the context, not from the input", async () => {
    await reserveForRepairOrderAction({
      repairOrderId: RO,
      lines: [{ repairOrderLineId: ROL, locationId: LOC, quantity: 2 }],
      organizationId: "evil-org",
      actorUserId: "evil-user",
    });
    expect(h.reserve.mock.calls[0][1]).toMatchObject({
      actorUserId: "user-1",
      organizationId: "org-1",
      branchId: "branch-1",
      repairOrderId: RO,
    });
    expect(h.reserve.mock.calls[0][1]).not.toHaveProperty("evil");
  });

  it("refuses writes without warehouse.inventory.operate", async () => {
    h.allow = ["warehouse.inventory.read"];
    const result = await releaseReservationLinesAction({
      lines: [{ reservationLineId: RL }],
      reason: "x",
    });
    expect(result).toEqual({ success: false, error: "unauthorized" });
    expect(h.release).not.toHaveBeenCalled();
  });

  it("a release needs a reason", async () => {
    const result = await releaseReservationLinesAction({
      lines: [{ reservationLineId: RL }],
      reason: "  ",
    });
    expect(result).toEqual({ success: false, error: "invalid_input" });
    expect(h.release).not.toHaveBeenCalled();
  });
});

describe("block actions", () => {
  it("'other' needs a description", async () => {
    const result = await blockStockAction({
      reasonCode: "other",
      lines: [{ quantity: 1, variantId: ROL, locationId: LOC }],
    });
    expect(result).toEqual({ success: false, error: "invalid_input" });
  });

  it("a line names a reservation, or an item and a location", async () => {
    const result = await blockStockAction({ reasonCode: "damaged", lines: [{ quantity: 1 }] });
    expect(result).toEqual({ success: false, error: "invalid_input" });
    const ok = await blockStockAction({
      reasonCode: "damaged",
      lines: [{ quantity: 1, reservationLineId: RL }],
    });
    expect(ok).toMatchObject({ success: true });
    expect(h.block.mock.calls[0][1]).toMatchObject({
      organizationId: "org-1",
      reasonCode: "damaged",
    });
  });

  it("blocked stock leaves only as return_to_supplier or scrap", async () => {
    const result = await issueBlockedStockAction({
      kind: "sell",
      lines: [{ blockLineId: RL }],
      reason: "x",
    });
    expect(result).toEqual({ success: false, error: "invalid_input" });
    expect(h.issue).not.toHaveBeenCalled();
  });
});
