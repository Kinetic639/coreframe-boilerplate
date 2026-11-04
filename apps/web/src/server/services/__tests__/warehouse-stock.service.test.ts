/**
 * @vitest-environment node
 *
 * U2: the AutoStacja magazyn of a delivered Matcher line -- the magazyn the
 * document names, else the default magazyn of the ZW's jednostka -- and the
 * stock per magazyn of a part.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  WarehouseStockService,
  pickWarehouse,
  unitCodeFromZw,
  type UnitForResolve,
} from "../warehouse-stock.service";

const UNITS: UnitForResolve[] = [
  {
    code: "3112",
    defaultWarehouseId: null,
    warehouses: [
      { id: "w115", code: "115" },
      { id: "w116", code: "116" },
    ],
  },
  { code: "3142", defaultWarehouseId: "w415", warehouses: [{ id: "w415", code: "415" }] },
  { code: "3332", defaultWarehouseId: "w315", warehouses: [{ id: "w315", code: "315" }] },
];

describe("pickWarehouse", () => {
  it("takes the magazyn the document names, whatever the ZW's jednostka", () => {
    // A Škoda order (ZW …/3332) delivered from BC's magazyn 415 (ZR section)
    expect(pickWarehouse({ warehouseCode: "415", unitCode: "3332" }, UNITS)).toBe("w415");
    expect(pickWarehouse({ warehouseCode: "116", unitCode: "3112" }, UNITS)).toBe("w116");
  });

  it("falls back to the default magazyn of the ZW's jednostka", () => {
    expect(pickWarehouse({ warehouseCode: null, unitCode: "3332" }, UNITS)).toBe("w315");
    expect(pickWarehouse({ warehouseCode: "999", unitCode: "3142" }, UNITS)).toBe("w415");
  });

  it("leaves the line without magazyn rather than guessing", () => {
    // 3112 has two magazyny and no default
    expect(pickWarehouse({ warehouseCode: null, unitCode: "3112" }, UNITS)).toBeNull();
    expect(pickWarehouse({ warehouseCode: null, unitCode: null }, UNITS)).toBeNull();
    expect(pickWarehouse({ warehouseCode: "515", unitCode: "3252" }, UNITS)).toBeNull();
  });

  it("reads the jednostka from the 4th part of the ZW", () => {
    expect(unitCodeFromZw("ZW/806/26/3252")).toBe("3252");
    expect(unitCodeFromZw("ZW/806/26")).toBeNull();
    expect(unitCodeFromZw(null)).toBeNull();
  });
});

// A chainable query mock: every builder method returns the chain, awaiting it
// resolves the rows registered for the table.
function client(rows: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const result = { data: rows[table] ?? [], error: null };
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "is", "or", "order"]) chain[m] = () => chain;
      chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
      return chain;
    },
  } as never;
}

describe("WarehouseStockService.resolveMatcherLineWarehouses", () => {
  it("uses the matched brand order's magazyn for a WDD line and the block's own for a BC order", async () => {
    const supabase = client({
      wdd_matcher_lines: [
        { id: "l-wdd", block_id: "b-wdd" },
        { id: "l-bc", block_id: "b-bc" },
      ],
      wdd_matcher_blocks: [
        { id: "b-wdd", block_type: "wdd_reconciliation", metadata: { warehouse_code: "415" } },
        {
          id: "b-bc",
          block_type: "direct_order",
          metadata: { zw_number: "ZW/153/26/3142", warehouse_code: null },
        },
        {
          id: "b-brand",
          block_type: "brand_order",
          metadata: { zw_number: "ZW/418/26/3112", warehouse_code: "116" },
        },
      ],
      wdd_matcher_block_matches: [
        {
          bc_block_id: null,
          wdd_block_id: "b-wdd",
          brand_block_id: "b-brand",
          block_confidence: 0.9,
        },
      ],
      branch_warehouses: [
        {
          code: "3112",
          default_warehouse_id: null,
          unit_warehouses: [
            { id: "w115", code: "115", is_active: true, deleted_at: null },
            { id: "w116", code: "116", is_active: true, deleted_at: null },
          ],
        },
        {
          code: "3142",
          default_warehouse_id: "w415",
          unit_warehouses: [{ id: "w415", code: "415", is_active: true, deleted_at: null }],
        },
      ],
    });

    const res = await WarehouseStockService.resolveMatcherLineWarehouses(supabase, "org", "br", [
      "l-wdd",
      "l-bc",
    ]);
    if (!res.success) throw new Error("failed");
    expect(res.data.get("l-wdd")).toBe("w116");
    expect(res.data.get("l-bc")).toBe("w415");
  });
});

describe("WarehouseStockService.forVariant", () => {
  it("lists the magazyny holding the part and what is not booked to one", async () => {
    const supabase = client({
      inventory_warehouse_stock: [
        {
          quantity: "2",
          unit_warehouses: {
            id: "w116",
            code: "116",
            name: "Lakiery",
            branch_warehouses: { code: "3112", name: "Volkswagen" },
          },
        },
        {
          quantity: 0,
          unit_warehouses: { id: "w115", code: "115", name: null, branch_warehouses: null },
        },
      ],
      inventory_balances: [{ on_hand_quantity: 3 }, { on_hand_quantity: "2" }],
    });
    const res = await WarehouseStockService.forVariant(supabase, "org", "br", "v1");
    if (!res.success) throw new Error("failed");
    expect(res.data.rows).toEqual([
      {
        warehouseId: "w116",
        warehouseCode: "116",
        warehouseName: "Lakiery",
        unitCode: "3112",
        unitName: "Volkswagen",
        quantity: 2,
      },
    ]);
    expect(res.data.onHand).toBe(5);
    expect(res.data.withoutWarehouse).toBe(3);
  });
});
