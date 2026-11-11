/** @vitest-environment node */
import { describe, expect, it, vi } from "vitest";
import { InventoryProductsService } from "../inventory-products.service";
import type { DataViewListParams } from "@/lib/data-view/types";
import type { SupabaseClient } from "@supabase/supabase-js";

function mockClient(matches: { product_id: string }[] = []) {
  const calls: { table: string; method: string; args: unknown[] }[] = [];
  const client = {
    from: vi.fn((table: string) => {
      const result = { data: table === "inventory_variants" ? matches : [], count: 0, error: null };
      const chain: Record<string, unknown> = {
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
      };
      for (const method of ["select", "eq", "is", "in", "ilike", "or", "order", "range"])
        chain[method] = (...args: unknown[]) => {
          calls.push({ table, method, args });
          return chain;
        };
      return chain;
    }),
  };
  return { client: client as unknown as SupabaseClient, calls };
}
const base: DataViewListParams = { search: "", sort: null, page: 1, pageSize: 20, filters: {} };
describe("product list filters", () => {
  for (const grouped of [true, false])
    it(`applies multi-selects and tenant scope when grouped=${grouped}`, async () => {
      const { client, calls } = mockClient();
      const result = await InventoryProductsService.listProducts(client, "org", {
        ...base,
        filters: {
          __group_variants: grouped,
          status: ["active", "archived"],
          product_type: ["stocked", "service"],
        },
      });
      expect(result.success).toBe(true);
      const table = grouped ? "inventory_products" : "inventory_product_list_rows_v1";
      expect(calls).toContainEqual({ table, method: "eq", args: ["organization_id", "org"] });
      expect(calls).toContainEqual({
        table,
        method: "in",
        args: ["status", ["active", "archived"]],
      });
      expect(calls).toContainEqual({
        table,
        method: "in",
        args: ["product_type", ["stocked", "service"]],
      });
    });
  it("finds a grouped product by a tenant-scoped SKU and escapes literal wildcards", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const { client, calls } = mockClient([{ product_id: id }]);
    await InventoryProductsService.listProducts(client, "org", { ...base, search: "100%_SKU" });
    expect(calls).toContainEqual({
      table: "inventory_variants",
      method: "eq",
      args: ["organization_id", "org"],
    });
    expect(calls).toContainEqual({
      table: "inventory_variants",
      method: "ilike",
      args: ["sku", "%100\\%\\_SKU%"],
    });
    expect(calls).toContainEqual({
      table: "inventory_products",
      method: "or",
      args: [`name.ilike.${JSON.stringify("%100\\%\\_SKU%")},id.in.(${id})`],
    });
  });
  it("matches variant SKUs in the ungrouped index", async () => {
    const { client, calls } = mockClient();
    await InventoryProductsService.listProducts(client, "org", {
      ...base,
      search: "SKU",
      filters: { __group_variants: false },
    });
    expect(calls).toContainEqual({
      table: "inventory_product_list_rows_v1",
      method: "or",
      args: ['product_name.ilike."%SKU%",variant_sku.ilike."%SKU%"'],
    });
  });
});
