/**
 * @vitest-environment node
 *
 * Zone 5 — a PZ (101) always lands in the branch's receiving zone, and a PZ
 * with lines delivered for a ZL is posted together with the reservations of
 * those parts, in one call (one transaction).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const VARIANT = "11111111-1111-4111-8111-111111111111";
const UNIT = "22222222-2222-4222-8222-222222222222";
const SHELF = "33333333-3333-4333-8333-333333333333";
const MATCHER_LINE = "44444444-4444-4444-8444-444444444444";
const WH_315 = "55555555-5555-4555-8555-555555555555";

const h = vi.hoisted(() => ({
  createAndFinalize: vi.fn(),
  createAndFinalizeReceipt: vi.fn(),
  createAndFinalizeReceipts: vi.fn(),
  createDraft: vi.fn(),
  getReceivingLocationId: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/utils/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({}),
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
    createAndFinalizeReceipt: (...a: unknown[]) => h.createAndFinalizeReceipt(...a),
    createAndFinalizeReceipts: (...a: unknown[]) => h.createAndFinalizeReceipts(...a),
    createDraft: (...a: unknown[]) => h.createDraft(...a),
  },
}));
vi.mock("@/server/services/warehouse-stock.service", () => ({
  WarehouseStockService: {
    resolveMatcherLineWarehouses: async (_s: unknown, _o: string, _b: string, ids: string[]) => ({
      success: true,
      data: new Map(ids.map((id) => [id, "55555555-5555-4555-8555-555555555555"])),
    }),
  },
}));
vi.mock("@/server/services/inventory-receiving.service", async () => {
  const actual = await vi.importActual<
    typeof import("@/server/services/inventory-receiving.service")
  >("@/server/services/inventory-receiving.service");
  return {
    summarizeReceiptAttribution: actual.summarizeReceiptAttribution,
    InventoryReceivingService: {
      getReceivingLocationId: (...a: unknown[]) => h.getReceivingLocationId(...a),
    },
  };
});

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
  source_order_number: "ZL/0042/2026/0301/BL",
  source_product_code: "N91158501",
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getReceivingLocationId.mockResolvedValue("prz");
  h.createAndFinalize.mockResolvedValue({ success: true, data: { movement_id: "mv-1" } });
  h.createAndFinalizeReceipt.mockResolvedValue({
    success: true,
    data: {
      movement_id: "mv-1",
      attribution: {
        attributed: [{ movement_line_id: "ml-2", reservation_number: "REZ/2026/000100" }],
        skipped: [{ reason: "no_repair_order" }],
      },
    },
  });
  h.createDraft.mockResolvedValue({ success: true, data: { movement_id: "mv-2" } });
});

describe("PZ lands in the receiving zone", () => {
  it("forces the receiving location as destination for a 101", async () => {
    await createAndPostMovementAction(
      payload("101", [
        { variant_id: VARIANT, unit_id: UNIT, quantity: 1, destination_location_id: SHELF },
      ])
    );
    expect(h.createAndFinalize.mock.calls[0][3].lines[0].destination_location_id).toBe("prz");
  });

  it("createDraft forces it too", async () => {
    await createDraftMovementAction(payload("101", [matcherLine]));
    expect(h.createDraft.mock.calls[0][3].lines[0].destination_location_id).toBe("prz");
  });

  it("books a Matcher line to the magazyn resolved on the server, others to the document's (U2/U3)", async () => {
    const manual = { ...matcherLine, source_type: null, source_line_id: null };
    await createDraftMovementAction({
      ...payload("101", [matcherLine, manual]),
      warehouse_id: WH_315,
    });
    const lines = h.createDraft.mock.calls[0][3].lines;
    expect(lines[0].warehouse_id).toBe(WH_315);
    expect(lines[1].warehouse_id).toBe(WH_315);
    expect(lines[0].destination_warehouse_id).toBeNull();
  });

  it("refuses a draft whose lines belong to several magazyny (one document = one magazyn)", async () => {
    const manual = { ...matcherLine, source_type: null, source_line_id: null };
    const result = await createDraftMovementAction(payload("101", [matcherLine, manual]));
    expect(result).toEqual({ success: false, error: "draft_several_warehouses" });
    expect(h.createDraft).not.toHaveBeenCalled();
  });

  it("posts a delivery of several magazyny as one PZ per magazyn, in one call (U3)", async () => {
    h.createAndFinalizeReceipts.mockResolvedValue({
      success: true,
      data: [
        {
          movement_id: "a",
          document_number: "PZ(315)/1/26/3332",
          status: "posted",
          route_key: "ra",
          attribution: { attributed: [{}], skipped: [] },
        },
        {
          movement_id: "b",
          document_number: "PZ/2026/000001",
          status: "posted",
          route_key: "rb",
          attribution: { attributed: [], skipped: [{ reason: "x" }] },
        },
      ],
    });
    const manual = { ...matcherLine, source_type: null, source_line_id: null };
    const result = (await createAndPostMovementAction(
      payload("101", [manual, matcherLine])
    )) as any;
    expect(h.createAndFinalizeReceipt).not.toHaveBeenCalled();
    const docs = h.createAndFinalizeReceipts.mock.calls[0][4];
    expect(
      docs.map((d: { lines: Array<{ warehouse_id: string | null }> }) =>
        d.lines.map((l) => l.warehouse_id)
      )
    ).toEqual([[null], [WH_315]]);
    // the matcher line is line 2 of the delivery, line 1 of its own PZ
    expect(docs[1].attribution).toEqual([
      {
        lineIndex: 1,
        zlNumber: "ZL/0042/2026/0301/BL",
        productCode: "N91158501",
        sourceLineId: MATCHER_LINE,
      },
    ]);
    expect(
      result.data.documents.map((d: { document_number: string }) => d.document_number)
    ).toEqual(["PZ(315)/1/26/3332", "PZ/2026/000001"]);
    expect(result.data.attribution).toMatchObject({ attributed: 1, skipped: 1 });
  });

  it("keeps the chosen destination for other movement types", async () => {
    await createAndPostMovementAction(payload("402", [matcherLine]));
    expect(h.getReceivingLocationId).not.toHaveBeenCalled();
    expect(h.createAndFinalize.mock.calls[0][3].lines[0].destination_location_id).toBe(SHELF);
    expect(h.createAndFinalizeReceipt).not.toHaveBeenCalled();
  });

  it("keeps the chosen destination (and reserves nothing) when the branch has no receiving zone", async () => {
    h.getReceivingLocationId.mockResolvedValue(null);
    await createAndPostMovementAction(payload("101", [matcherLine]));
    expect(h.createAndFinalize.mock.calls[0][3].lines[0].destination_location_id).toBe(SHELF);
    expect(h.createAndFinalizeReceipt).not.toHaveBeenCalled();
  });
});

describe("A PZ with lines for a ZL reserves them in the same transaction", () => {
  it("posts through one call naming the ZL lines by position (1-based), and summarises the result", async () => {
    const manual = {
      variant_id: VARIANT,
      unit_id: UNIT,
      quantity: 1,
      destination_location_id: SHELF,
    };
    const result = await createAndPostMovementAction({
      ...payload("101", [manual, matcherLine]),
      warehouse_id: WH_315,
    });
    expect(h.createAndFinalize).not.toHaveBeenCalled();
    const call = h.createAndFinalizeReceipt.mock.calls[0];
    expect(
      call[3].lines.map((l: { destination_location_id: string }) => l.destination_location_id)
    ).toEqual(["prz", "prz"]);
    expect(call[4]).toBe("user-1");
    expect(call[5]).toEqual([
      {
        lineIndex: 2,
        zlNumber: "ZL/0042/2026/0301/BL",
        productCode: "N91158501",
        sourceLineId: MATCHER_LINE,
      },
    ]);
    expect(result).toEqual({
      success: true,
      data: {
        movement_id: "mv-1",
        attribution: {
          attributed: 1,
          internalOrders: [],
          skipped: 1,
          skippedReasons: { no_repair_order: 1 },
        },
      },
    });
  });

  it("a PZ without ZL lines is posted the plain way", async () => {
    await createAndPostMovementAction(
      payload("101", [
        { variant_id: VARIANT, unit_id: UNIT, quantity: 1, destination_location_id: SHELF },
      ])
    );
    expect(h.createAndFinalizeReceipt).not.toHaveBeenCalled();
    expect(h.createAndFinalize).toHaveBeenCalledTimes(1);
  });

  it("returns the error when the PZ with reservations fails (nothing was posted)", async () => {
    h.createAndFinalizeReceipt.mockResolvedValue({ success: false, error: "boom" });
    const result = await createAndPostMovementAction(payload("101", [matcherLine]));
    expect(result).toEqual({ success: false, error: "boom" });
    expect(h.createAndFinalize).not.toHaveBeenCalled();
  });
});
