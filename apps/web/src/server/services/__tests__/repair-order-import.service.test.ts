import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { loadOrders } = vi.hoisted(() => ({ loadOrders: vi.fn() }));
vi.mock("../repair-order-import-adapters/svwms-wdd-matcher.adapter", () => ({
  svwmsWddMatcherRepairOrderImportAdapter: {
    sourceType: "svwms_wdd_matcher",
    label: "Matcher",
    description: "",
    loadSourceFields: vi.fn(),
    loadOrders,
  },
}));

import { RepairOrderImportService, normalizeProductCode } from "../repair-order-import.service";

type Rows = Record<string, unknown[]>;

function client(rows: Rows, rpcResult: { data?: unknown; error?: unknown } = {}) {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: rpcResult.data ?? null, error: rpcResult.error ?? null });
  return {
    rpc,
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "order"]) chain[m] = () => chain;
      chain.then = (ok: (v: unknown) => unknown) => ok({ data: rows[table] ?? [], error: null });
      return chain;
    },
  } as never;
}

const order = (zl: string | null, lines: Array<Record<string, unknown>>, extra = {}) => ({
  key: `b-${zl}`,
  zlNumber: zl,
  orderNumber: null,
  vin: "WVW123",
  vehicleBrand: "VW",
  clientName: "Jan Kowalski",
  dealerName: null,
  source: { sessionId: "s1", blockId: `b-${zl}` },
  lines: lines.map((l) => ({
    productCode: null,
    productName: null,
    quantity: 1,
    unit: "szt",
    rawText: null,
    matcherLineId: null,
    ...l,
  })),
  ...extra,
});

describe("normalizeProductCode", () => {
  it("ignores spacing, dashes and case", () => {
    expect(normalizeProductCode(" n91-158 501 ")).toBe("N91158501");
    expect(normalizeProductCode("")).toBeNull();
  });
});

describe("RepairOrderImportService.preview", () => {
  it("classifies new, existing, conflicting and already-imported orders", async () => {
    loadOrders.mockResolvedValue({
      success: true,
      data: [
        order("ZL/1", [{ productCode: "A-1", matcherLineId: "m1" }]),
        order("ZL/2", [
          { productCode: "B1", matcherLineId: "m2" },
          { productCode: "C1", matcherLineId: "m3" },
        ]),
        order("ZL/3", [{ productCode: "D1", matcherLineId: "m4" }]),
        order(null, [{ productCode: "E1" }]),
      ],
    });
    const supabase = client({
      repair_orders: [
        { id: "ro2", zl_number: "ZL/2", status: "open" },
        { id: "ro3", zl_number: "ZL/3", status: "closed" },
      ],
      repair_order_lines: [{ repair_order_id: "ro2", product_code: "b-1" }],
      workshop_source_document_lines: [{ wdd_matcher_line_id: "m2" }],
    });

    const result = await RepairOrderImportService.preview(
      supabase,
      "org",
      "br",
      "svwms_wdd_matcher",
      {
        session_id: "s1",
      }
    );
    expect(result.success).toBe(true);
    const data = (result as { data: any }).data;
    const byZl = Object.fromEntries(data.orders.map((o: any) => [o.zlNumber ?? "none", o]));

    expect(byZl["ZL/1"]).toMatchObject({ status: "new", willChange: true });
    expect(byZl["ZL/2"]).toMatchObject({
      status: "existing",
      repairOrderId: "ro2",
      willChange: true,
    });
    expect(byZl["ZL/2"].lines.map((l: any) => l.state)).toEqual(["already_imported", "new"]);
    expect(byZl["ZL/3"]).toMatchObject({
      status: "conflict",
      conflictReason: "repair_order_closed",
      willChange: false,
    });
    expect(byZl.none).toMatchObject({ status: "conflict", conflictReason: "missing_zl" });
    expect(data.counts).toEqual({ new: 1, existing: 1, conflict: 2, unchanged: 0 });
  });

  it("marks an existing order with nothing new as unchanged", async () => {
    loadOrders.mockResolvedValue({
      success: true,
      data: [order("ZL/2", [{ productCode: "B1", matcherLineId: "m2" }])],
    });
    const supabase = client({
      repair_orders: [{ id: "ro2", zl_number: "ZL/2", status: "open" }],
      repair_order_lines: [{ repair_order_id: "ro2", product_code: "B1" }],
      workshop_source_document_lines: [{ wdd_matcher_line_id: "m2" }],
    });
    const result = await RepairOrderImportService.preview(
      supabase,
      "org",
      "br",
      "svwms_wdd_matcher",
      {}
    );
    const data = (result as { data: any }).data;
    expect(data.orders[0].willChange).toBe(false);
    expect(data.counts.unchanged).toBe(1);
  });
});

describe("RepairOrderImportService.apply", () => {
  it("re-reads the source and sends only the selected ZLs with provenance", async () => {
    loadOrders.mockResolvedValue({
      success: true,
      data: [
        order("ZL/1", [{ productCode: "A1", matcherLineId: "m1", quantity: 2 }]),
        order("ZL/2", [{ productCode: "B1" }]),
      ],
    });
    const supabase = client({}, { data: { created: 1, updated: 0, unchanged: 0, conflicts: 0 } });
    const result = await RepairOrderImportService.apply(supabase, {
      actorUserId: "u1",
      organizationId: "org",
      branchId: "br",
      sourceType: "svwms_wdd_matcher",
      sourceInput: { session_id: "s1" },
      zlNumbers: ["ZL/1"],
    });
    expect(result).toEqual({
      success: true,
      data: { created: 1, updated: 0, unchanged: 0, conflicts: 0 },
    });
    const call = (supabase as any).rpc.mock.calls[0];
    expect(call[0]).toBe("repair_orders_import");
    expect(call[1].p_orders).toHaveLength(1);
    expect(call[1].p_orders[0]).toMatchObject({
      zl_number: "ZL/1",
      source: { session_id: "s1", block_id: "b-ZL/1" },
      lines: [{ product_code: "A1", quantity: 2, matcher_line_id: "m1" }],
    });
  });

  it("maps a permission failure", async () => {
    loadOrders.mockResolvedValue({ success: true, data: [order("ZL/1", [{ productCode: "A1" }])] });
    const supabase = client({}, { error: { code: "42501", message: "no" } });
    const result = await RepairOrderImportService.apply(supabase, {
      actorUserId: "u1",
      organizationId: "org",
      branchId: "br",
      sourceType: "svwms_wdd_matcher",
      sourceInput: {},
      zlNumbers: ["ZL/1"],
    });
    expect(result).toEqual({ success: false, error: "unauthorized" });
  });
});
