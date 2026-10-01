/**
 * @vitest-environment node
 *
 * Zone 5 — a PZ (101) always lands in the branch's receiving zone, and a
 * posted PZ imported from the Matcher is attributed to RepairOrderLines.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const VARIANT = "11111111-1111-4111-8111-111111111111";
const UNIT = "22222222-2222-4222-8222-222222222222";
const SHELF = "33333333-3333-4333-8333-333333333333";
const MATCHER_LINE = "44444444-4444-4444-8444-444444444444";

const h = vi.hoisted(() => ({
  createAndFinalize: vi.fn(),
  createDraft: vi.fn(),
  getReceivingLocationId: vi.fn(),
  attributeReceipt: vi.fn(),
  postedLines: [] as Array<{ id: string; line_number: number }>,
}));

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockImplementation(async () => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is"]) chain[m] = () => chain;
    chain.order = () => Promise.resolve({ data: h.postedLines, error: null });
    return { from: () => chain };
  }),
}));
vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: vi.fn().mockResolvedValue({
    app: { activeOrgId: "org-1", activeBranchId: "branch-1" },
    user: {
      user: { id: "user-1" },
      permissionSnapshot: {
        allow: ["module.warehouse.access", "warehouse.read", "warehouse.inventory.operate"],
        deny: [],
      },
    },
  }),
}));
vi.mock("@/server/guards/entitlements-guards", () => ({
  entitlements: { requireModuleAccess: vi.fn().mockResolvedValue(undefined) },
  mapEntitlementError: vi.fn().mockReturnValue(null),
}));
vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: vi.fn().mockResolvedValue({ success: true }) },
}));
vi.mock("@/server/services/inventory-movements.service", () => ({
  InventoryMovementsService: {
    createAndFinalize: (...a: unknown[]) => h.createAndFinalize(...a),
    createDraft: (...a: unknown[]) => h.createDraft(...a),
  },
}));
vi.mock("@/server/services/inventory-receiving.service", () => ({
  InventoryReceivingService: {
    getReceivingLocationId: (...a: unknown[]) => h.getReceivingLocationId(...a),
    attributeReceipt: (...a: unknown[]) => h.attributeReceipt(...a),
  },
}));

import { createAndPostMovementAction, createDraftMovementAction } from "../index";

function payload(code: string, lines: Array<Record<string, unknown>>) {
  return { movement_type_code: code, lines };
}

const matcherLine = {
  variant_id: VARIANT,
  unit_id: UNIT,
  quantity: 2,
  destination_location_id: SHELF,
  source_type: "svwms_wdd_matcher",
  source_line_id: MATCHER_LINE,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.postedLines = [{ id: "ml-1", line_number: 1 }];
  h.getReceivingLocationId.mockResolvedValue("prz");
  h.createAndFinalize.mockResolvedValue({ success: true, data: { movement_id: "mv-1" } });
  h.createDraft.mockResolvedValue({ success: true, data: { movement_id: "mv-2" } });
  h.attributeReceipt.mockResolvedValue({ success: true, data: { attributed: 1, skipped: 0 } });
});

describe("PZ lands in the receiving zone", () => {
  it("createAndPost forces the receiving location as destination for a 101", async () => {
    await createAndPostMovementAction(payload("101", [matcherLine]));
    const lines = h.createAndFinalize.mock.calls[0][3].lines;
    expect(lines[0].destination_location_id).toBe("prz");
  });

  it("createDraft forces it too", async () => {
    await createDraftMovementAction(payload("101", [matcherLine]));
    expect(h.createDraft.mock.calls[0][3].lines[0].destination_location_id).toBe("prz");
  });

  it("keeps the chosen destination for other movement types", async () => {
    await createAndPostMovementAction(payload("402", [matcherLine]));
    expect(h.getReceivingLocationId).not.toHaveBeenCalled();
    expect(h.createAndFinalize.mock.calls[0][3].lines[0].destination_location_id).toBe(SHELF);
  });

  it("keeps the chosen destination when the branch has no receiving zone", async () => {
    h.getReceivingLocationId.mockResolvedValue(null);
    await createAndPostMovementAction(payload("101", [matcherLine]));
    expect(h.createAndFinalize.mock.calls[0][3].lines[0].destination_location_id).toBe(SHELF);
    expect(h.attributeReceipt).not.toHaveBeenCalled();
  });
});

describe("Matcher-imported PZ is attributed after posting", () => {
  it("pairs posted lines (by position) with their Matcher source lines", async () => {
    h.postedLines = [
      { id: "ml-1", line_number: 1 },
      { id: "ml-2", line_number: 2 },
    ];
    const manual = {
      variant_id: VARIANT,
      unit_id: UNIT,
      quantity: 1,
      destination_location_id: SHELF,
    };
    await createAndPostMovementAction(payload("101", [manual, matcherLine]));
    expect(h.attributeReceipt).toHaveBeenCalledWith(expect.anything(), "user-1", "mv-1", [
      { movementLineId: "ml-2", sourceLineId: MATCHER_LINE },
    ]);
  });

  it("does not attribute a PZ without imported lines", async () => {
    await createAndPostMovementAction(
      payload("101", [
        { variant_id: VARIANT, unit_id: UNIT, quantity: 1, destination_location_id: SHELF },
      ])
    );
    expect(h.attributeReceipt).not.toHaveBeenCalled();
  });

  it("does not attribute when posting failed", async () => {
    h.createAndFinalize.mockResolvedValue({ success: false, error: "boom" });
    const result = await createAndPostMovementAction(payload("101", [matcherLine]));
    expect(result).toEqual({ success: false, error: "boom" });
    expect(h.attributeReceipt).not.toHaveBeenCalled();
  });
});
