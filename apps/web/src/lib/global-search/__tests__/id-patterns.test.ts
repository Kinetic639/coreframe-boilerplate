import { describe, expect, it } from "vitest";
import { detectSearchIds } from "../id-patterns";

const kinds = (value: string) => detectSearchIds(value).map((id) => id.kind);

describe("detectSearchIds", () => {
  it("recognizes a full DMS repair order number", () => {
    expect(detectSearchIds(" zlec/172957/26/3332/BL ")).toEqual([
      {
        kind: "repairOrderFull",
        value: "ZLEC/172957/26/3332/BL",
        orderNo: "172957",
        year: 26,
        warehouseCode: "3332",
      },
    ]);
    expect(kinds("ZL/174232/2026/3122")).toEqual(["repairOrderFull"]);
  });

  it("normalizes HD- and PT- numbers to their stored form", () => {
    expect(detectSearchIds("hd-12")).toEqual([{ kind: "ticket", value: "HD-000012" }]);
    expect(detectSearchIds("HD000031")).toEqual([{ kind: "ticket", value: "HD-000031" }]);
    expect(detectSearchIds("pt-14")).toEqual([{ kind: "task", value: "PT-000014" }]);
  });

  it("recognizes stock document numbers", () => {
    expect(detectSearchIds("pz/2026/24")).toEqual([{ kind: "document", value: "PZ/2026/000024" }]);
    expect(kinds("INW/2026/000018")).toEqual(["document"]);
  });

  it("treats a bare 5–7 digit number as an order number and a code", () => {
    expect(kinds("174232")).toEqual(["repairOrderNumber", "code"]);
  });

  it("recognizes a VIN, which is also a possible code", () => {
    expect(kinds("TMBAR7NP7N7012333")).toEqual(["vin", "code"]);
    // I, O, Q are never in a VIN
    expect(kinds("TMBAR7NP7N70123IO")).toEqual(["code"]);
  });

  it("treats part numbers, containers and locations as codes", () => {
    expect(kinds("2K5807221KGRU")).toEqual(["code"]);
    expect(kinds("K-174232-01")).toEqual(["code"]);
    expect(kinds("mc/gab-01")).toEqual(["code"]);
  });

  it("ignores phrases and short text", () => {
    expect(kinds("nowe zlecenie")).toEqual([]);
    expect(kinds("zl")).toEqual([]);
    expect(kinds("")).toEqual([]);
  });
});
