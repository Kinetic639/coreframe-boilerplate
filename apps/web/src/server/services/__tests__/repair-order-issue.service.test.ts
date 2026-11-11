/**
 * @vitest-environment node
 *
 * Phase 10F — RepairOrderIssueService: candidate building (container parts
 * vs reserved-at-location material, outstanding quantities) for both
 * reservation shapes (one REZ per order with the order line on each
 * reservation line, and older one-REZ-per-order-line headers), and the RW
 * issue RPC call/mapping.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { RepairOrderIssueService } from "../repair-order-issue.service";

type Filters = Record<string, unknown>;
function client(
  resolve: (table: string, f: Filters) => unknown[],
  fail?: (table: string) => boolean
) {
  return {
    from(table: string) {
      const f: Filters = {};
      const chain: Record<string, unknown> = {};
      chain.select = () => chain;
      chain.eq = (k: string, v: unknown) => ((f[k] = v), chain);
      chain.in = (k: string, v: unknown) => ((f[`in:${k}`] = v), chain);
      chain.neq = () => chain;
      chain.is = () => chain;
      chain.then = (ok: (v: unknown) => unknown) =>
        ok(
          fail?.(table)
            ? { data: null, error: { message: "boom" } }
            : { data: resolve(table, f), error: null }
        );
      return chain;
    },
  } as never;
}

const orderLines = [
  { id: "rol1", product_code: "5H0807221", product_name: "Zderzak", variant_id: "v1" },
  { id: "rol2", product_code: "WHT005263", product_name: "Spinka", variant_id: "v2" },
  { id: "rol3", product_code: "N91158501", product_name: "Nit", variant_id: "v3" },
];

function shared(table: string) {
  switch (table) {
    case "repair_order_lines":
      return orderLines;
    case "inventory_allocation_lines":
      return [
        {
          id: "al1",
          reservation_line_id: "rl1",
          variant_id: "v1",
          location_id: "zlc",
          allocated_quantity: 1,
          fulfilled_quantity: 0,
        },
      ];
    case "inventory_allocation_container_links":
      return [{ allocation_line_id: "al1", container_line_id: "cl1" }];
    case "inventory_container_lines":
      return [{ id: "cl1", container_id: "c1" }];
    case "inventory_containers":
      return [{ id: "c1", code: "K-184213-02" }];
    case "inventory_variants":
      return [
        { id: "v1", sku: "5H0807221GRU" },
        { id: "v2", sku: "WHT005263" },
        { id: "v3", sku: "N91158501" },
      ];
    case "warehouse_locations":
      return [
        { id: "zlc", code: "ZLC-01", name: "Regał" },
        { id: "prz", code: "PRZ", name: "Strefa przyjęć" },
        { id: "bin", code: "SZ-02", name: "Kuweta" },
      ];
    default:
      return [];
  }
}

describe("RepairOrderIssueService.listCandidates", () => {
  it("finds parts of the order's one REZ (order line on each reservation line), legacy per-line REZ too", async () => {
    const supabase = client((table) => {
      // One REZ for the whole order (PZ / "reserve from stock" / transfer).
      if (table === "inventory_reservation_lines") {
        return [
          {
            id: "rl1",
            reservation_id: "rez-order",
            repair_order_line_id: "rol1",
            variant_id: "v1",
            location_id: "zlc",
            reserved_quantity: 1,
            released_quantity: 0,
            fulfilled_quantity: 1,
          },
          {
            // Still in the receiving zone: issued straight from there.
            id: "rl2",
            reservation_id: "rez-order",
            repair_order_line_id: "rol2",
            variant_id: "v2",
            location_id: "prz",
            reserved_quantity: 20,
            released_quantity: 0,
            fulfilled_quantity: 5,
          },
        ];
      }
      // An older document: the order line only in the header.
      if (table === "inventory_reservations") {
        return [
          {
            id: "rez-old",
            reference_id: "rol3",
            inventory_reservation_lines: [
              {
                id: "rl3",
                reservation_id: "rez-old",
                repair_order_line_id: null,
                variant_id: "v3",
                location_id: "bin",
                reserved_quantity: 10,
                released_quantity: 0,
                fulfilled_quantity: 0,
              },
            ],
          },
        ];
      }
      return shared(table);
    });

    const result = await RepairOrderIssueService.listCandidates(supabase, "ro1");
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([
      {
        kind: "allocation",
        sourceId: "al1",
        repairOrderLineId: "rol1",
        productCode: "5H0807221",
        productName: "Zderzak",
        sku: "5H0807221GRU",
        outstanding: 1,
        location: { id: "zlc", code: "ZLC-01", name: "Regał" },
        containers: ["K-184213-02"],
      },
      {
        kind: "reservation",
        sourceId: "rl2",
        repairOrderLineId: "rol2",
        productCode: "WHT005263",
        productName: "Spinka",
        sku: "WHT005263",
        outstanding: 15,
        location: { id: "prz", code: "PRZ", name: "Strefa przyjęć" },
        containers: [],
      },
      {
        kind: "reservation",
        sourceId: "rl3",
        repairOrderLineId: "rol3",
        productCode: "N91158501",
        productName: "Nit",
        sku: "N91158501",
        outstanding: 10,
        location: { id: "bin", code: "SZ-02", name: "Kuweta" },
        containers: [],
      },
    ]);
  });

  it("fails instead of showing nothing to issue when the reservations cannot be read", async () => {
    const result = await RepairOrderIssueService.listCandidates(
      client(shared, (table) => table === "inventory_reservation_lines"),
      "ro1"
    );
    expect(result).toEqual({ success: false, error: "Failed to load reservations" });
  });

  it("returns nothing when the order has no lines", async () => {
    const result = await RepairOrderIssueService.listCandidates(
      client(() => []),
      "ro1"
    );
    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("RepairOrderIssueService.issue", () => {
  const input = {
    actorUserId: "u",
    organizationId: "org",
    branchId: "b",
    repairOrderId: "ro1",
    recipient: "Jan Kowalski",
    note: null,
    lines: [
      { kind: "allocation" as const, sourceId: "al1", repairOrderLineId: "rol1", quantity: 1 },
      { kind: "reservation" as const, sourceId: "rl2", repairOrderLineId: "rol2", quantity: 15 },
    ],
  };

  it("sends allocation/reservation sources and maps the RW result", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { movement_id: "mv", document_number: "RW/2026/000001", line_count: 2 },
      error: null,
    });
    const result = await RepairOrderIssueService.issue({ rpc } as never, input);
    expect(rpc).toHaveBeenCalledWith("repair_order_issue_parts", {
      p_actor_user_id: "u",
      p_organization_id: "org",
      p_branch_id: "b",
      p_repair_order_id: "ro1",
      p_lines: [
        { repair_order_line_id: "rol1", quantity: 1, allocation_line_id: "al1" },
        { repair_order_line_id: "rol2", quantity: 15, reservation_line_id: "rl2" },
      ],
      p_recipient: "Jan Kowalski",
      p_note: null,
    });
    expect(result).toEqual({
      success: true,
      data: { movementId: "mv", documentNumber: "RW/2026/000001", lineCount: 2 },
    });
  });

  it.each([
    [{ code: "42501", message: "Missing" }, "unauthorized"],
    [{ code: "22023", message: "A recipient is required" }, "recipient_required"],
    [{ code: "22023", message: "Line 1: only 0 left to issue from this allocation" }, "not_enough"],
    [{ code: "P0003", message: "Movement would strand committed stock" }, "insufficient_stock"],
    [{ code: "P0002", message: "Repair order not found" }, "not_found"],
    [{ code: "XX000", message: "boom" }, "unexpected"],
  ])("maps %o to %s", async (error, expected) => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    expect(await RepairOrderIssueService.issue({ rpc } as never, input)).toEqual({
      success: false,
      error: expected,
    });
  });
});
