/**
 * @vitest-environment node
 *
 * Zone 5 — InventoryReceivingService: RPC arguments, result mapping and the
 * stable putaway error codes.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InventoryReceivingService } from "../inventory-receiving.service";

function rpcClient(result: { data?: unknown; error?: { code?: string; message: string } }) {
  const rpc = vi.fn().mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
  return { client: { rpc } as never, rpc };
}

describe("InventoryReceivingService.listPending", () => {
  it("maps RO, bulk and free rows", async () => {
    const { client, rpc } = rpcClient({
      data: {
        receiving_location_id: "prz",
        items: [
          {
            variant_id: "v1",
            product_id: "p1",
            sku: "5H0807221",
            product_name: "Zderzak",
            unit_id: "u",
            unit_code: "szt",
            quantity: 1,
            document_number: "PZ/2026/000010",
            repair_order_line_id: "rol1",
            repair_order_id: "ro1",
            zl_number: "184213",
            vehicle_brand: "VW",
            handling_mode: "standard",
            container_id: "c1",
            container_code: "K-184213-02",
            container_location_id: "l1",
            container_location_code: "ZLC-01",
            container_location_name: "Regał",
          },
          {
            variant_id: "v2",
            product_id: "p2",
            sku: "WHT005263",
            quantity: 20,
            handling_mode: "bulk",
            default_location_id: "bin",
            default_location_code: "SZ-02",
            default_location_name: "Kuweta 4",
            repair_order_line_id: "rol2",
            repair_order_id: "ro1",
          },
          { variant_id: "v1", product_id: "p1", quantity: 3, handling_mode: "standard" },
        ],
      },
    });
    const result = await InventoryReceivingService.listPending(client, "org", "branch");
    expect(rpc).toHaveBeenCalledWith("inventory_receiving_pending", {
      p_organization_id: "org",
      p_branch_id: "branch",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.receivingLocationId).toBe("prz");
    const [ro, bulk, free] = result.data.items;
    expect(ro.container).toEqual({
      id: "c1",
      code: "K-184213-02",
      locationId: "l1",
      locationCode: "ZLC-01",
      locationName: "Regał",
    });
    expect(bulk.handlingMode).toBe("bulk");
    expect(bulk.defaultLocation).toEqual({ id: "bin", code: "SZ-02", name: "Kuweta 4" });
    expect(free.repairOrderLineId).toBeNull();
    expect(free.container).toBeNull();
    expect(free.quantity).toBe(3);
  });

  it("returns an error on RPC failure", async () => {
    const { client } = rpcClient({ error: { code: "42501", message: "Missing" } });
    const result = await InventoryReceivingService.listPending(client, "org", "branch");
    expect(result.success).toBe(false);
  });
});

describe("InventoryReceivingService.putaway", () => {
  const input = {
    actorUserId: "user",
    organizationId: "org",
    branchId: "branch",
    variantId: "v1",
    quantity: 2,
    destinationLocationId: "l1",
    repairOrderLineId: "rol1",
  };

  it("passes server identity and maps a container result", async () => {
    const { client, rpc } = rpcClient({
      data: {
        mode: "container",
        movement_id: "mv",
        document_number: "MM/2026/000003",
        destination_location_id: "l1",
        quantity: 2,
        reserved_quantity: 2,
        zl_number: "184213",
        container_id: "c9",
        container_code: "K-184213-04",
        container_created: true,
      },
    });
    const result = await InventoryReceivingService.putaway(client, input);
    expect(rpc).toHaveBeenCalledWith("inventory_putaway_from_receiving", {
      p_actor_user_id: "user",
      p_organization_id: "org",
      p_branch_id: "branch",
      p_variant_id: "v1",
      p_quantity: 2,
      p_destination_location_id: "l1",
      p_repair_order_line_id: "rol1",
      p_container_id: null,
    });
    expect(result).toEqual({
      success: true,
      data: {
        mode: "container",
        movementId: "mv",
        documentNumber: "MM/2026/000003",
        destinationLocationId: "l1",
        quantity: 2,
        reservedQuantity: 2,
        zlNumber: "184213",
        containerId: "c9",
        containerCode: "K-184213-04",
        containerCreated: true,
      },
    });
  });

  it.each([
    [{ code: "42501", message: "Missing warehouse.inventory.operate permission" }, "unauthorized"],
    [
      { code: "28000", message: "p_actor_user_id must match the authenticated caller" },
      "unauthorized",
    ],
    [
      { code: "P0002", message: "No active receiving location configured for this branch" },
      "no_receiving_location",
    ],
    [
      { code: "22023", message: "Destination is not a valid stockable location in this branch" },
      "invalid_destination",
    ],
    [
      { code: "22023", message: "Not enough free stock of this item in the receiving zone" },
      "not_enough",
    ],
    [
      {
        code: "22023",
        message:
          "Line 1 requests 1 but only 0 is currently attributed to this RepairOrderLine at the receiving location",
      },
      "not_enough",
    ],
    [{ code: "22023", message: "Item does not match the RepairOrderLine's product" }, "wrong_item"],
    [{ code: "P0002", message: "RepairOrderLine not found" }, "not_found"],
    [{ code: "XX000", message: "boom" }, "unexpected"],
  ])("maps %o to %s", async (error, expected) => {
    const { client } = rpcClient({ error });
    expect(await InventoryReceivingService.putaway(client, input)).toEqual({
      success: false,
      error: expected,
    });
  });
});

describe("InventoryReceivingService.attributeReceipt", () => {
  it("skips the RPC when nothing is to be attributed", async () => {
    const { client, rpc } = rpcClient({});
    const result = await InventoryReceivingService.attributeReceipt(client, "user", "mv", []);
    expect(rpc).not.toHaveBeenCalled();
    expect(result).toEqual({
      success: true,
      data: { attributed: 0, skipped: 0, skippedReasons: {} },
    });
  });

  it("attributes by ZL + part code and counts skipped reasons", async () => {
    const { client, rpc } = rpcClient({
      data: {
        attributed: [{}, {}],
        skipped: [
          { reason: "no_repair_order" },
          { reason: "no_repair_order" },
          { reason: "already_received" },
        ],
      },
    });
    const result = await InventoryReceivingService.attributeReceipt(client, "user", "mv", [
      { movementLineId: "ml1", zlNumber: "ZL/1/2026", productCode: "N911" },
    ]);
    expect(rpc).toHaveBeenCalledWith("inventory_attribute_receipt_to_repair_orders", {
      p_actor_user_id: "user",
      p_movement_id: "mv",
      p_lines: [{ movement_line_id: "ml1", zl_number: "ZL/1/2026", product_code: "N911" }],
    });
    expect(result).toEqual({
      success: true,
      data: {
        attributed: 2,
        skipped: 3,
        skippedReasons: { no_repair_order: 2, already_received: 1 },
      },
    });
  });
});

describe("InventoryReceivingService.getReceiptReport", () => {
  type Filters = Record<string, unknown>;
  function client(
    resolve: (table: string, filters: Filters) => unknown[] | null,
    rpcData: unknown
  ) {
    return {
      rpc: vi.fn().mockResolvedValue({ data: rpcData, error: null }),
      from(table: string) {
        const filters: Filters = {};
        const chain: Record<string, unknown> = {};
        for (const m of ["select", "order"]) chain[m] = () => chain;
        chain.eq = (k: string, v: unknown) => ((filters[k] = v), chain);
        chain.in = (k: string, v: unknown) => ((filters[`in:${k}`] = v), chain);
        chain.is = () => chain;
        chain.gte = (k: string, v: unknown) => ((filters[`gte:${k}`] = v), chain);
        chain.maybeSingle = () =>
          Promise.resolve({ data: (resolve(table, filters) ?? [])[0] ?? null });
        chain.then = (ok: (v: unknown) => unknown) =>
          ok({ data: resolve(table, filters), error: null });
        return chain;
      },
    } as never;
  }

  it("traces an RO line into its container and a free line through the 801 out of PRZ", async () => {
    const supabase = client(
      (table, f) => {
        if (table === "warehouse_locations" && f.purpose === "receiving") return [{ id: "prz" }];
        if (table === "repair_order_line_movement_links" && f.relation_type === "receipt")
          return [{ repair_order_line_id: "rol1", inventory_movement_line_id: "pz-l1" }];
        if (table === "repair_order_line_movement_links" && f.relation_type === "relocation")
          return [
            {
              repair_order_line_id: "rol1",
              inventory_movement_line_id: "mm-l1",
              applied_quantity: 1,
            },
          ];
        if (table === "repair_order_lines") return [{ id: "rol1", repair_order_id: "ro1" }];
        if (table === "repair_orders") return [{ id: "ro1", zl_number: "184213" }];
        if (table === "inventory_movement_lines" && f["in:id"])
          return [
            {
              id: "mm-l1",
              movement_id: "mm1",
              variant_id: "v1",
              source_location_id: "prz",
              destination_location_id: "zlc",
              quantity: 1,
            },
          ];
        if (table === "inventory_movement_lines" && f.source_location_id === "prz")
          return [
            {
              id: "mm-l2",
              movement_id: "mm2",
              variant_id: "v2",
              source_location_id: "prz",
              destination_location_id: "shelf",
              quantity: 2,
            },
          ];
        if (table === "inventory_containers")
          return [
            { id: "c1", code: "K-184213-02", reference_id: "ro1", current_location_id: "zlc" },
          ];
        if (table === "inventory_container_lines")
          return [{ container_id: "c1", variant_id: "v1" }];
        if (table === "inventory_movement_headers")
          return [
            { id: "mm1", document_number: "MM/2026/000001" },
            { id: "mm2", document_number: "MM/2026/000002" },
          ];
        if (table === "warehouse_locations")
          return [
            { id: "zlc", code: "ZLC-01", name: "Regał" },
            { id: "shelf", code: "MC-R01", name: "Półka" },
          ];
        return [];
      },
      {
        receiving_location_id: "prz",
        items: [{ variant_id: "v2", product_id: "p2", quantity: 1, handling_mode: "standard" }],
      }
    );

    const result = await InventoryReceivingService.getReceiptReport(supabase, "org", "branch", {
      movementId: "pz",
      postedAt: "2026-10-01T10:00:00Z",
      lines: [
        {
          id: "pz-l1",
          line_number: 1,
          variant_id: "v1",
          sku: "5H0807221",
          product_name: "Zderzak",
          quantity: 1,
          unit_code: "szt",
        },
        {
          id: "pz-l2",
          line_number: 2,
          variant_id: "v2",
          sku: "N-123",
          product_name: "Śruba",
          quantity: 3,
          unit_code: "szt",
        },
      ],
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const [ro, free] = result.data;
    expect(ro.zlNumber).toBe("184213");
    expect(ro.putaway).toEqual([
      {
        locationCode: "ZLC-01",
        locationName: "Regał",
        quantity: 1,
        documentNumber: "MM/2026/000001",
      },
    ]);
    expect(ro.containers).toEqual([
      { code: "K-184213-02", locationCode: "ZLC-01", locationName: "Regał" },
    ]);
    expect(ro.pendingQuantity).toBe(0);
    expect(free.zlNumber).toBeNull();
    expect(free.putaway).toEqual([
      {
        locationCode: "MC-R01",
        locationName: "Półka",
        quantity: 2,
        documentNumber: "MM/2026/000002",
      },
    ]);
    expect(free.pendingQuantity).toBe(1);
  });
});
