/**
 * @vitest-environment node
 *
 * The MM picker (stock in a source location) offers only free stock:
 * reserved, allocated and blocked pieces stay out -- the engine would refuse
 * to strand them, and reserved parts move by putaway.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InventoryMovementsService } from "../inventory-movements.service";

function client(rows: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const result = { data: rows[table] ?? [], error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "or", "gt", "order", "limit"])
        chain[m] = () => chain;
      chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
      return chain;
    },
  } as never;
}

describe("InventoryMovementsService.searchPickerItems in a source location", () => {
  it("lists only the free quantity and leaves fully reserved parts out", async () => {
    const supabase = client({
      inventory_balances: [
        {
          variant_id: "v-res",
          on_hand_quantity: 3,
          reserved_quantity: 3,
          allocated_quantity: 0,
          blocked: 0,
        },
        {
          variant_id: "v-part",
          on_hand_quantity: 5,
          reserved_quantity: 2,
          allocated_quantity: 0,
          blocked: 0,
        },
      ],
      inventory_variants: [{ id: "v-part", sku: "P1", barcode: null, product_id: "p1" }],
      inventory_products: [
        { id: "p1", name: "Part 1", base_unit_id: "u1", brand_name: null, manufacturer_name: null },
      ],
      inventory_units: [{ id: "u1", code: "szt" }],
    });
    const res = await InventoryMovementsService.searchPickerItems(supabase, "org", "br", {
      sourceLocationId: "loc",
    });
    if (!res.success) throw new Error("failed");
    expect(res.data.map((i) => [i.variant_id, i.source_location_on_hand])).toEqual([["v-part", 3]]);
  });

  it("returns nothing when everything at the location is reserved", async () => {
    const supabase = client({
      inventory_balances: [
        {
          variant_id: "v-res",
          on_hand_quantity: 3,
          reserved_quantity: 3,
          allocated_quantity: 0,
          blocked: 0,
        },
      ],
    });
    const res = await InventoryMovementsService.searchPickerItems(supabase, "org", "br", {
      sourceLocationId: "loc",
    });
    expect(res).toEqual({ success: true, data: [] });
  });
});
