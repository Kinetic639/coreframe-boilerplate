/**
 * @vitest-environment node
 *
 * Zone 6 fixes — product search also matches part numbers (SKU/barcode),
 * and location history labels movements by kind with who performed them.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { InventoryProductsService } from "../inventory-products.service";
import { movementKindForCode } from "../ambra-location-inventory.service";

function recordingClient(variantHits: Array<{ product_id: string }>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const record =
        (method: string) =>
        (...args: unknown[]) => {
          calls.push({ table, method, args });
          return chain;
        };
      for (const m of ["select", "eq", "is", "in", "ilike", "or", "order", "limit"])
        chain[m] = record(m);
      chain.range = (...args: unknown[]) => {
        calls.push({ table, method: "range", args });
        return Promise.resolve({ data: [], error: null, count: 0 });
      };
      chain.then = (ok: (v: unknown) => unknown) =>
        ok({ data: table === "inventory_variants" ? variantHits : [], error: null });
      return chain;
    },
  };
  return { client: client as never, calls };
}

const params = { search: "5H0807221", sort: null, page: 1, pageSize: 25, filters: {} } as never;

describe("product search by part number", () => {
  it("matches product name OR the products whose variant SKU/barcode matches", async () => {
    const { client, calls } = recordingClient([
      { product_id: "p1" },
      { product_id: "p1" },
      { product_id: "p2" },
    ]);
    await InventoryProductsService.listProducts(client, "org", params, null);

    const variantOr = calls.find((c) => c.table === "inventory_variants" && c.method === "or");
    expect(variantOr?.args[0]).toBe("sku.ilike.%5H0807221%,barcode.ilike.%5H0807221%");
    const productOr = calls.find((c) => c.table === "inventory_products" && c.method === "or");
    expect(productOr?.args[0]).toBe("name.ilike.%5H0807221%,id.in.(p1,p2)");
  });

  it("falls back to the name only when no part number matches", async () => {
    const { client, calls } = recordingClient([]);
    await InventoryProductsService.listProducts(client, "org", params, null);
    const nameIlike = calls.find((c) => c.table === "inventory_products" && c.method === "ilike");
    expect(nameIlike?.args).toEqual(["name", "%5H0807221%"]);
  });

  it("neutralises characters that would break the or-filter", async () => {
    const { client, calls } = recordingClient([]);
    await InventoryProductsService.listProducts(
      client,
      "org",
      { ...(params as object), search: "a,b)(c*" } as never,
      null
    );
    const variantOr = calls.find((c) => c.table === "inventory_variants" && c.method === "or");
    expect(variantOr?.args[0]).toBe("sku.ilike.%a b  c%,barcode.ilike.%a b  c%");
  });
});

describe("movementKindForCode", () => {
  it.each([
    ["101", "receipt"],
    ["801", "transfer"],
    ["311", "transfer"],
    ["312", "transfer"],
    ["261", "issue"],
    ["402", "adjustment"],
    ["900", "reversal"],
    ["999", "999"],
  ])("%s -> %s", (code, kind) => {
    expect(movementKindForCode(code)).toBe(kind);
  });
});
