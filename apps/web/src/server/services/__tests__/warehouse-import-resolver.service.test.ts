/**
 * @vitest-environment node
 */

import { describe, expect, it } from "vitest";
import { WarehouseImportResolverService } from "../warehouse-import-resolver.service";

describe("WarehouseImportResolverService", () => {
  it("resolves variants by exact SKU before normalized fingerprint fallback", () => {
    const context = {
      variantsByExactToken: new Map([
        ["ab-123", [{ id: "variant-exact", sku: "AB-123", barcode: null }]],
      ]),
      variantsByFingerprint: new Map([
        [
          "AB123",
          [
            { id: "variant-exact", sku: "AB-123", barcode: null },
            { id: "variant-normalized", sku: "AB 123", barcode: null },
          ],
        ],
      ]),
      unitsByExactToken: new Map(),
      unitsByFingerprint: new Map(),
    };

    const result = WarehouseImportResolverService.resolveVariant(context, "AB-123");

    expect(result).toMatchObject({
      status: "resolved",
      value: { id: "variant-exact" },
    });
  });

  it("falls back to SKU fingerprint when exact variant token is missing", () => {
    const context = {
      variantsByExactToken: new Map(),
      variantsByFingerprint: new Map([
        ["57H823031", [{ id: "variant-1", sku: "57H823031", barcode: null }]],
      ]),
      unitsByExactToken: new Map(),
      unitsByFingerprint: new Map(),
    };

    const result = WarehouseImportResolverService.resolveVariant(context, "57H-823-031");

    expect(result).toMatchObject({
      status: "resolved",
      value: { id: "variant-1" },
    });
  });

  it("marks ambiguous variant fingerprints without guessing", () => {
    const context = {
      variantsByExactToken: new Map(),
      variantsByFingerprint: new Map([
        [
          "AB123",
          [
            { id: "variant-1", sku: "AB-123", barcode: null },
            { id: "variant-2", sku: "AB 123", barcode: null },
          ],
        ],
      ]),
      unitsByExactToken: new Map(),
      unitsByFingerprint: new Map(),
    };

    const result = WarehouseImportResolverService.resolveVariant(context, "AB/123");

    expect(result.status).toBe("ambiguous");
    expect(result.matches).toHaveLength(2);
  });

  it("resolves units by exact code and normalized fallback", () => {
    const context = {
      variantsByExactToken: new Map(),
      variantsByFingerprint: new Map(),
      unitsByExactToken: new Map([["szt", [{ id: "unit-szt", code: "SZT", name: "sztuka" }]]]),
      unitsByFingerprint: new Map([["KPL", [{ id: "unit-kpl", code: "KPL.", name: "komplet" }]]]),
    };

    expect(WarehouseImportResolverService.resolveUnit(context, "SZT")).toMatchObject({
      status: "resolved",
      value: { id: "unit-szt" },
    });
    expect(WarehouseImportResolverService.resolveUnit(context, "kpl")).toMatchObject({
      status: "resolved",
      value: { id: "unit-kpl" },
    });
  });

  it("returns missing when source value is empty or unknown", () => {
    const context = {
      variantsByExactToken: new Map(),
      variantsByFingerprint: new Map(),
      unitsByExactToken: new Map(),
      unitsByFingerprint: new Map(),
    };

    expect(WarehouseImportResolverService.resolveVariant(context, "")).toMatchObject({
      status: "missing",
    });
    expect(WarehouseImportResolverService.resolveUnit(context, "UNKNOWN")).toMatchObject({
      status: "missing",
    });
  });
});
