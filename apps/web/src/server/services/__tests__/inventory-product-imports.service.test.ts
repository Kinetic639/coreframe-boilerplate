/**
 * @vitest-environment node
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryProductImportsService } from "../inventory-product-imports.service";
import { InventoryProductsService } from "../inventory-products.service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";
const USER_ID = "22222222-2222-4222-8222-222222222222";
const UNIT_ID = "33333333-3333-4333-8333-333333333333";

type Operation = {
  table: string;
  action: string;
  payload?: Record<string, unknown>;
  filters?: Record<string, unknown>;
};

function createImportSupabaseMock(
  options: {
    existingVariants?: Array<{ sku: string | null }>;
    completedJobUpdateError?: string;
  } = {}
) {
  const operations: Operation[] = [];
  const client = {
    operations,
    from: vi.fn((table: string) => {
      const chain = {
        data: table === "inventory_variants" ? (options.existingVariants ?? []) : null,
        error: null as { message: string } | null,
        payload: undefined as Record<string, unknown> | undefined,
        filters: {} as Record<string, unknown>,
        select() {
          operations.push({ table, action: "select" });
          return chain;
        },
        insert(payload: Record<string, unknown>) {
          operations.push({ table, action: "insert", payload });
          chain.payload = payload;
          return chain;
        },
        update(payload: Record<string, unknown>) {
          operations.push({ table, action: "update", payload });
          chain.payload = payload;
          if (
            table === "inventory_import_jobs" &&
            payload.status === "completed" &&
            options.completedJobUpdateError
          ) {
            chain.error = { message: options.completedJobUpdateError };
          }
          return chain;
        },
        eq(column: string, value: unknown) {
          chain.filters[column] = value;
          return chain;
        },
        is(column: string, value: unknown) {
          chain.filters[column] = value;
          return chain;
        },
        in(column: string, value: unknown[]) {
          chain.filters[column] = value;
          operations.push({ table, action: "filter.in", filters: { [column]: value } });
          return chain;
        },
        single() {
          if (table === "inventory_import_jobs" || table === "inventory_export_jobs") {
            return { data: { id: `${table}-1` }, error: null };
          }
          return { data: chain.data, error: chain.error };
        },
      };
      return chain;
    }),
  };
  return client;
}

function mockMasterData() {
  vi.spyOn(InventoryProductsService, "listUnits").mockResolvedValue({
    success: true,
    data: [
      {
        id: UNIT_ID,
        code: "P",
        name: "piece",
        unit_kind: "count",
        precision: 0,
        is_base: true,
        is_active: true,
      },
    ] as never,
  });
  vi.spyOn(InventoryProductsService, "checkSkuCollisions").mockResolvedValue({
    success: true,
    data: [],
  });
  vi.spyOn(InventoryProductsService, "listCustomFields").mockResolvedValue({
    success: true,
    data: [],
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InventoryProductImportsService.importProductsFromCsv", () => {
  it("rolls back products already created when a later import group fails", async () => {
    mockMasterData();
    const supabase = createImportSupabaseMock();
    vi.spyOn(InventoryProductsService, "createEnhancedProduct")
      .mockResolvedValueOnce({
        success: true,
        data: { product_id: "product-1", variant_ids: ["variant-1"], sku: "SKU-1" },
      })
      .mockResolvedValueOnce({ success: false, error: "second product failed" });

    const csv = [
      "product_name,product_sku,variant_sku,unit_code",
      "First,SKU-1,SKU-1,P",
      "Second,SKU-2,SKU-2,P",
    ].join("\n");

    const result = await InventoryProductImportsService.importProductsFromCsv(
      supabase as never,
      ORG_ID,
      csv,
      USER_ID,
      "create_only"
    );

    expect(result).toEqual({ success: false, error: "second product failed" });
    expect(InventoryProductsService.createEnhancedProduct).toHaveBeenCalledTimes(2);
    expect(supabase.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "inventory_variants",
          action: "update",
          payload: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
        expect.objectContaining({
          table: "inventory_products",
          action: "update",
          payload: expect.objectContaining({ deleted_at: expect.any(String) }),
        }),
        expect.objectContaining({
          table: "inventory_import_jobs",
          action: "update",
          payload: expect.objectContaining({
            status: "failed",
            summary: expect.objectContaining({ rolled_back_products: 1 }),
          }),
        }),
      ])
    );
    expect(supabase.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "inventory_variants",
          action: "filter.in",
          filters: { product_id: ["product-1"] },
        }),
        expect.objectContaining({
          table: "inventory_products",
          action: "filter.in",
          filters: { id: ["product-1"] },
        }),
      ])
    );
  });

  it("skips existing rows by normalized SKU fingerprint in skip_existing mode", async () => {
    mockMasterData();
    const supabase = createImportSupabaseMock({
      existingVariants: [{ sku: "N90619802" }],
    });
    vi.spyOn(InventoryProductsService, "createEnhancedProduct").mockResolvedValue({
      success: true,
      data: { product_id: "product-2", variant_ids: ["variant-2"], sku: "R2016V" },
    });

    const csv = [
      "product_name,product_sku,variant_sku,unit_code",
      "Existing,N90 619 802,N90 619 802,P",
      "New,R2016V,R2016V,P",
    ].join("\n");

    const result = await InventoryProductImportsService.importProductsFromCsv(
      supabase as never,
      ORG_ID,
      csv,
      USER_ID,
      "skip_existing"
    );

    expect(result).toEqual({
      success: true,
      data: {
        imported_products: 1,
        imported_variants: 1,
        skipped_rows: 1,
        job_id: "inventory_import_jobs-1",
      },
    });
    expect(InventoryProductsService.createEnhancedProduct).toHaveBeenCalledTimes(1);
    expect(InventoryProductsService.createEnhancedProduct).toHaveBeenCalledWith(
      expect.anything(),
      ORG_ID,
      expect.objectContaining({ name: "New", sku: "R2016V" }),
      USER_ID
    );
  });
});

describe("InventoryProductImportsService.exportProductsCsv", () => {
  function productRow(index: number) {
    return {
      id: `product-${index}`,
      row_id: `product-${index}`,
      name: `Product ${index}`,
      sku: `SKU-${index}`,
      product_type: "stocked",
      status: "active",
      thumbnail_url: null,
      variant_count: 1,
      on_hand_quantity: 0,
      available_quantity: 0,
      unit_code: "P",
      updated_at: new Date(0).toISOString(),
      sales_account_code: null,
      purchase_account_code: null,
      tax_code: null,
      tax_rate_percent: null,
      tags: [],
      custom_field_values: {},
      variants: [
        {
          id: `variant-${index}`,
          product_id: `product-${index}`,
          sku: `SKU-${index}`,
          name: `Product ${index}`,
          status: "active",
          is_default: true,
          barcode: null,
          purchase_price: null,
          sales_price: null,
          price_currency: null,
          thumbnail_url: null,
          on_hand_quantity: 0,
          available_quantity: 0,
          reorder_point: null,
          option_values: [],
          custom_field_values: {},
        },
      ],
    };
  }

  it("exports every product page instead of only the first page", async () => {
    const supabase = createImportSupabaseMock();
    vi.spyOn(InventoryProductsService, "listProducts")
      .mockResolvedValueOnce({
        success: true,
        data: {
          rows: Array.from({ length: 500 }, (_, index) => productRow(index + 1)),
          totalCount: 501,
          page: 1,
          pageSize: 500,
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          rows: [productRow(501)],
          totalCount: 501,
          page: 2,
          pageSize: 500,
        },
      });

    const result = await InventoryProductImportsService.exportProductsCsv(
      supabase as never,
      ORG_ID,
      USER_ID
    );

    expect(result.success).toBe(true);
    expect(InventoryProductsService.listProducts).toHaveBeenCalledTimes(2);
    if (result.success) {
      expect(result.data.csv.split("\n").filter(Boolean)).toHaveLength(502);
      expect(result.data.job_id).toBe("inventory_export_jobs-1");
    }
    expect(supabase.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "inventory_export_jobs",
          action: "update",
          payload: expect.objectContaining({
            status: "completed",
            summary: { exported_rows: 501, product_rows: 501 },
          }),
        }),
      ])
    );
  });

  it("marks the export job failed when product listing fails", async () => {
    const supabase = createImportSupabaseMock();
    vi.spyOn(InventoryProductsService, "listProducts").mockResolvedValue({
      success: false,
      error: "list failed",
    });

    const result = await InventoryProductImportsService.exportProductsCsv(
      supabase as never,
      ORG_ID,
      USER_ID
    );

    expect(result).toEqual({ success: false, error: "list failed" });
    expect(supabase.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "inventory_export_jobs",
          action: "update",
          payload: expect.objectContaining({
            status: "failed",
            error_message: "list failed",
          }),
        }),
      ])
    );
  });
});
