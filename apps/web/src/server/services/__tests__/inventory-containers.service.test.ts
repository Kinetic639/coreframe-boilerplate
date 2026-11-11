/**
 * @vitest-environment node
 *
 * Phase 10D — InventoryContainersService read models: code suggestion and
 * the container detail / RepairOrder-container list mapping.
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InventoryContainersService } from "../inventory-containers.service";

const ORG = "org-1";
const BRANCH = "branch-1";
const CONTAINER = "c-1";
const RO = "ro-1";

type Rows = Record<string, unknown[] | Record<string, unknown> | null>;

/** Minimal PostgREST-ish chain: every filter returns the chain; `maybeSingle`
 * and awaiting the chain resolve to the table's canned rows. */
function makeClient(rows: Rows) {
  return {
    from(table: string) {
      const value = rows[table];
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "is", "in", "order"]) chain[m] = () => chain;
      chain.maybeSingle = () =>
        Promise.resolve({ data: Array.isArray(value) ? (value[0] ?? null) : value, error: null });
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: Array.isArray(value) ? value : value ? [value] : [], error: null });
      return chain;
    },
  } as never;
}

const containerRow = {
  id: CONTAINER,
  organization_id: ORG,
  branch_id: BRANCH,
  code: "K-184213-01",
  type: "container",
  status: "active",
  current_location_id: "loc-1",
  reference_type: "repair_order",
  reference_id: RO,
  created_at: "2026-09-30T10:00:00Z",
  updated_at: "2026-09-30T10:00:00Z",
};

const baseRows: Rows = {
  inventory_containers: [containerRow],
  inventory_container_lines: [
    { id: "l-1", container_id: CONTAINER, variant_id: "v-1", unit_id: "u-1", quantity: "1" },
    { id: "l-2", container_id: CONTAINER, variant_id: "v-2", unit_id: "u-1", quantity: 10 },
  ],
  inventory_variants: [
    { id: "v-1", product_id: "p-1", sku: "5H0807221HGRU" },
    { id: "v-2", product_id: "p-2", sku: "WHT005263" },
  ],
  inventory_units: [{ id: "u-1", code: "SZT" }],
  inventory_products: [
    { id: "p-1", name: "Zderzak przedni gruntowany – VW Golf VIII" },
    { id: "p-2", name: "Spinka listwy i spojlera zderzaka" },
  ],
  warehouse_locations: [{ id: "loc-1", name: "Półka ZLC-01", code: "ZLC-01" }],
  repair_orders: {
    id: RO,
    zl_number: "184213",
    client_name: "Tomasz Wiśniewski",
    vehicle_brand: "Volkswagen",
    vin: "WVWZZZCDZNW012487",
  },
};

describe("InventoryContainersService.suggestCode", () => {
  it("proposes K-<ZL>-01 for a RepairOrder without containers", () => {
    expect(InventoryContainersService.suggestCode("184213", [])).toBe("K-184213-01");
  });

  it("proposes the next number after existing containers", () => {
    expect(InventoryContainersService.suggestCode("184213", ["K-184213-01"])).toBe("K-184213-02");
  });

  it("skips a code that is already taken (case-insensitive)", () => {
    expect(InventoryContainersService.suggestCode("184213", ["k-184213-02", "OTHER"])).toBe(
      "K-184213-03"
    );
  });

  it("falls back to a ZL placeholder when the order has no ZL number", () => {
    expect(InventoryContainersService.suggestCode(null, [])).toBe("K-ZL-01");
  });
});

describe("InventoryContainersService.getDetail", () => {
  it("maps contents, location and RepairOrder", async () => {
    const result = await InventoryContainersService.getDetail(makeClient(baseRows), ORG, CONTAINER);

    expect(result.success).toBe(true);
    const detail = (result as { success: true; data: NonNullable<unknown> }).data as {
      code: string;
      branchId: string;
      currentLocation: unknown;
      repairOrder: unknown;
      lines: unknown[];
    };
    expect(detail.code).toBe("K-184213-01");
    expect(detail.branchId).toBe(BRANCH);
    expect(detail.currentLocation).toEqual({ id: "loc-1", name: "Półka ZLC-01", code: "ZLC-01" });
    expect(detail.repairOrder).toEqual({
      id: RO,
      zlNumber: "184213",
      clientName: "Tomasz Wiśniewski",
      vehicleBrand: "Volkswagen",
      vin: "WVWZZZCDZNW012487",
    });
    expect(detail.lines).toEqual([
      {
        id: "l-1",
        variantId: "v-1",
        sku: "5H0807221HGRU",
        productName: "Zderzak przedni gruntowany – VW Golf VIII",
        quantity: 1,
        unitCode: "SZT",
      },
      {
        id: "l-2",
        variantId: "v-2",
        sku: "WHT005263",
        productName: "Spinka listwy i spojlera zderzaka",
        quantity: 10,
        unitCode: "SZT",
      },
    ]);
  });

  it("returns null (not an error) when RLS hides the container", async () => {
    const result = await InventoryContainersService.getDetail(
      makeClient({ ...baseRows, inventory_containers: [] }),
      ORG,
      CONTAINER
    );
    expect(result).toEqual({ success: true, data: null });
  });

  it("a container without a RepairOrder has repairOrder: null", async () => {
    const result = await InventoryContainersService.getDetail(
      makeClient({
        ...baseRows,
        inventory_containers: [{ ...containerRow, reference_type: null, reference_id: null }],
      }),
      ORG,
      CONTAINER
    );
    expect(
      (result as { success: true; data: { repairOrder: unknown } }).data.repairOrder
    ).toBeNull();
  });
});

describe("InventoryContainersService.listForRepairOrder", () => {
  it("summarises each container's location and number of lines", async () => {
    const result = await InventoryContainersService.listForRepairOrder(
      makeClient(baseRows),
      ORG,
      BRANCH,
      RO
    );
    expect(result).toEqual({
      success: true,
      data: [
        {
          id: CONTAINER,
          code: "K-184213-01",
          status: "active",
          currentLocation: { id: "loc-1", name: "Półka ZLC-01", code: "ZLC-01" },
          lineCount: 2,
          totalQuantity: 11,
        },
      ],
    });
  });

  it("returns an empty list when the RepairOrder has no containers", async () => {
    const result = await InventoryContainersService.listForRepairOrder(
      makeClient({ ...baseRows, inventory_containers: [] }),
      ORG,
      BRANCH,
      RO
    );
    expect(result).toEqual({ success: true, data: [] });
  });
});

describe("InventoryContainersService.relocate (Phase 10E)", () => {
  const input = {
    actorUserId: "user-1",
    organizationId: ORG,
    branchId: BRANCH,
    containerId: CONTAINER,
    destinationLocationId: "loc-b",
  };

  function rpcClient(result: { data?: unknown; error?: { code?: string; message: string } }) {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: result.data ?? null, error: result.error ?? null });
    return { client: { rpc } as never, rpc };
  }

  it("calls inventory_relocate_container with server-provided identity and maps the result", async () => {
    const { client, rpc } = rpcClient({
      data: {
        container_id: CONTAINER,
        movement_id: "mv-1",
        document_number: "MM/2026/000007",
        source_location_id: "loc-a",
        destination_location_id: "loc-b",
        line_count: 2,
      },
    });
    const result = await InventoryContainersService.relocate(client, input);
    expect(rpc).toHaveBeenCalledWith("inventory_relocate_container", {
      p_actor_user_id: "user-1",
      p_organization_id: ORG,
      p_branch_id: BRANCH,
      p_container_id: CONTAINER,
      p_destination_location_id: "loc-b",
      p_note: null,
    });
    expect(result).toEqual({
      success: true,
      data: {
        containerId: CONTAINER,
        movementId: "mv-1",
        documentNumber: "MM/2026/000007",
        sourceLocationId: "loc-a",
        destinationLocationId: "loc-b",
        lineCount: 2,
      },
    });
  });

  it("an empty container returns no movement", async () => {
    const { client } = rpcClient({
      data: {
        container_id: CONTAINER,
        movement_id: null,
        destination_location_id: "loc-b",
        line_count: 0,
      },
    });
    const result = await InventoryContainersService.relocate(client, input);
    expect(result.success && result.data.movementId).toBeNull();
  });

  it.each([
    [{ code: "42501", message: "Missing warehouse.inventory.operate permission" }, "unauthorized"],
    [
      { code: "28000", message: "p_actor_user_id must match the authenticated caller" },
      "unauthorized",
    ],
    [{ code: "P0002", message: "Container not found" }, "not_found"],
    [{ code: "55000", message: "Container cannot be relocated (status: archived)" }, "not_movable"],
    [{ code: "22023", message: "Container is already at this location" }, "same_location"],
    [
      { code: "22023", message: "Destination is not a valid stockable location in this branch" },
      "invalid_destination",
    ],
    [
      { code: "22023", message: "Container contents do not match their allocations" },
      "inconsistent",
    ],
    [{ code: "P0003", message: "Movement would strand committed stock: …" }, "inconsistent"],
    [{ code: "XX000", message: "boom" }, "unexpected"],
  ])("maps %o to %s", async (error, expected) => {
    const { client } = rpcClient({ error });
    const result = await InventoryContainersService.relocate(client, input);
    expect(result).toEqual({ success: false, error: expected });
  });
});
