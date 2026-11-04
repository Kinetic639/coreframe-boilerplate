import { describe, expect, it } from "vitest";
import { splitByWarehouse, warehousesOf } from "../split-by-warehouse";

describe("splitByWarehouse (one document = one magazyn)", () => {
  const lines = [
    { sku: "A", warehouse_id: "w115" },
    { sku: "B", warehouse_id: "w315" },
    { sku: "C", warehouse_id: "w115" },
    { sku: "D", warehouse_id: null },
  ];

  it("makes one part per magazyn, keeping the line order", () => {
    const parts = splitByWarehouse(lines, []);
    expect(parts.map((p) => [p.warehouseId, p.lines.map((l) => l.sku)])).toEqual([
      ["w115", ["A", "C"]],
      ["w315", ["B"]],
      [null, ["D"]],
    ]);
  });

  it("renumbers the attribution within each part", () => {
    const parts = splitByWarehouse(lines, [
      { lineIndex: 3, zlNumber: "ZL/1", productCode: "C", sourceLineId: "m3" },
      { lineIndex: 2, zlNumber: "ZL/2", productCode: "B" },
      { lineIndex: 9, zlNumber: "ZL/x", productCode: "?" },
    ]);
    expect(parts[0].attribution).toEqual([
      { lineIndex: 2, zlNumber: "ZL/1", productCode: "C", sourceLineId: "m3" },
    ]);
    expect(parts[1].attribution).toEqual([{ lineIndex: 1, zlNumber: "ZL/2", productCode: "B" }]);
    expect(parts[2].attribution).toEqual([]);
  });

  it("lists the distinct magazyny", () => {
    expect(warehousesOf(lines)).toEqual(["w115", "w315", null]);
    expect(warehousesOf([{ warehouse_id: "w1" }, {}])).toEqual(["w1", null]);
  });
});
