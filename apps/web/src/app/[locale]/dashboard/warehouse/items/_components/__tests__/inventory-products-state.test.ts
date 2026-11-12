import { describe, expect, it } from "vitest";
import {
  loadProductState,
  migrateProductSearchParams,
  productListParams,
  productHref,
} from "../inventory-products-state";

describe("product table URL contract", () => {
  it("preserves literal percent signs in custom filters", () => {
    const state = loadProductState({
      filters: JSON.stringify({ "custom_field:test": "100% zapasu" }),
    });
    const restored = loadProductState(
      new URL(productHref("https://example.com/products", state)).searchParams
    );
    expect(restored.filters["custom_field:test"]).toBe("100% zapasu");
  });
  it("passes multi-selects to the backend as arrays", () => {
    const state = loadProductState({ status: "active,archived", product_type: "stocked,service" });
    expect(productListParams(state).filters).toMatchObject({
      status: ["active", "archived"],
      product_type: ["stocked", "service"],
    });
  });
  it("rejects unknown statuses and unsupported sort fields", () => {
    const state = loadProductState({
      status: "invalid",
      sort: "unit_cost",
      selected: "not-an-id",
    });
    expect(state.status).toEqual([]);
    expect(state.sort).toBe("updated_at");
    expect(state.selected).toBeNull();
  });
  it("sorts by stock sums and filters by stock, for the grouped list only", () => {
    const grouped = loadProductState({
      sort: "available_quantity",
      stan: "reserved,blocked,bogus",
    });
    expect(grouped.sort).toBe("available_quantity");
    expect(productListParams(grouped).filters.stock).toEqual(["reserved", "blocked"]);
    const flat = loadProductState({ stan: "reserved", grouped: "false" });
    expect(productListParams(flat).filters.stock).toBeNull();
  });
  it("migrates legacy deep links without losing the selected record or custom filter", () => {
    const id = "22222222-2222-4222-8222-222222222222";
    const migration = migrateProductSearchParams({
      selected: id,
      search: "100%",
      page: "2",
      pageSize: "20",
      sort: "name.asc",
      filters: JSON.stringify({
        status: "active",
        __group_variants: false,
        is_variant: true,
        "custom_field:test": "100%",
      }),
    });
    expect(migration.changed).toBe(true);
    const state = loadProductState(migration.params);
    expect(state).toMatchObject({
      selected: id,
      q: "100%",
      strona: 2,
      wierszy: 20,
      sort: "name",
      direction: "asc",
      status: ["active"],
      grouped: false,
      is_variant: ["true"],
      filters: { "custom_field:test": "100%" },
    });
    expect(
      migrateProductSearchParams(
        Object.fromEntries(new URL(productHref("https://example.com/products", state)).searchParams)
      ).changed
    ).toBe(false);
  });
  it("retains list state when closing a selected variant", () => {
    const state = loadProductState({
      selected: "22222222-2222-4222-8222-222222222222::33333333-3333-4333-8333-333333333333",
      q: "SKU",
      status: "active",
      strona: "3",
    });
    const closed = loadProductState(
      new URL(productHref("https://example.com/products", state, { selected: null })).searchParams
    );
    expect(closed).toMatchObject({ selected: null, q: "SKU", status: ["active"], strona: 3 });
  });
  it("ignores malformed legacy JSON and clamps nonpositive backend page values", () => {
    expect(productListParams(loadProductState({ filters: "broken", strona: "-10" }))).toMatchObject(
      { page: 1, filters: { status: null } }
    );
  });
});
