/**
 * @vitest-environment node
 */

import { describe, expect, it, vi } from "vitest";
import { WarehouseImportResolverService } from "../warehouse-import-resolver.service";

describe("WarehouseImportResolverService", () => {
  it("resolves variants by exact SKU before normalized fingerprint fallback", () => {
    const context = {
      variantsByExactToken: new Map([
        [
          "ab-123",
          [
            {
              id: "variant-exact",
              product_id: "product-1",
              sku: "AB-123",
              barcode: null,
              unit_id: "unit-szt",
            },
          ],
        ],
      ]),
      variantsByFingerprint: new Map([
        [
          "AB123",
          [
            {
              id: "variant-exact",
              product_id: "product-1",
              sku: "AB-123",
              barcode: null,
              unit_id: "unit-szt",
            },
            {
              id: "variant-normalized",
              product_id: "product-2",
              sku: "AB 123",
              barcode: null,
              unit_id: "unit-szt",
            },
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
        [
          "57H823031",
          [
            {
              id: "variant-1",
              product_id: "product-1",
              sku: "57H823031",
              barcode: null,
              unit_id: "unit-szt",
            },
          ],
        ],
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
            {
              id: "variant-1",
              product_id: "product-1",
              sku: "AB-123",
              barcode: null,
              unit_id: "unit-szt",
            },
            {
              id: "variant-2",
              product_id: "product-2",
              sku: "AB 123",
              barcode: null,
              unit_id: "unit-szt",
            },
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

  it("builds variant candidates with product base units without embedded joins", async () => {
    const variantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ id: "variant-1", product_id: "product-1", sku: "SKU-1", barcode: null }],
        error: null,
      }),
    };
    const unitsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ id: "unit-szt", code: "SZT", name: "sztuka" }],
        error: null,
      }),
    };
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: "product-1", base_unit_id: "unit-szt" }],
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "inventory_variants") return variantQuery;
        if (table === "inventory_units") return unitsQuery;
        if (table === "inventory_products") return productsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await WarehouseImportResolverService.buildContext(supabase as never, "org-1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(variantQuery.select).toHaveBeenCalledWith("id, product_id, sku, barcode");
    expect(productsQuery.in).toHaveBeenCalledWith("id", ["product-1"]);
    expect(WarehouseImportResolverService.resolveVariant(result.data, "SKU-1")).toMatchObject({
      status: "resolved",
      value: { id: "variant-1", product_id: "product-1", unit_id: "unit-szt" },
    });
  });

  it("does not expose product base units that are not valid organization units", async () => {
    const variantQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ id: "variant-1", product_id: "product-1", sku: "SKU-1", barcode: null }],
        error: null,
      }),
    };
    const unitsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({
        data: [{ id: "unit-szt", code: "SZT", name: "sztuka" }],
        error: null,
      }),
    };
    const productsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ id: "product-1", base_unit_id: "deleted-unit" }],
        error: null,
      }),
    };
    const supabase = {
      from: vi.fn((table: string) => {
        if (table === "inventory_variants") return variantQuery;
        if (table === "inventory_units") return unitsQuery;
        if (table === "inventory_products") return productsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await WarehouseImportResolverService.buildContext(supabase as never, "org-1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(WarehouseImportResolverService.resolveVariant(result.data, "SKU-1")).toMatchObject({
      status: "resolved",
      value: { id: "variant-1", product_id: "product-1", unit_id: null },
    });
  });
});
