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

describe("saved product views", () => {
  it("keep the search, filters and sort, never the page or the open product", async () => {
    const { viewQuery } = await import("../inventory-products-views");
    const query = viewQuery(
      loadProductState({
        q: "szyba",
        status: "active",
        sort: "available_quantity",
        direction: "asc",
        strona: "3",
        selected: "22222222-2222-4222-8222-222222222222",
        tab: "stock",
      })
    );
    const params = new URLSearchParams(query.replace(/^\?/, ""));
    expect(params.get("q")).toBe("szyba");
    expect(params.get("status")).toBe("active");
    expect(params.get("sort")).toBe("available_quantity");
    expect(params.has("strona")).toBe(false);
    expect(params.has("selected")).toBe(false);
    expect(params.has("tab")).toBe(false);
    expect(viewQuery(loadProductState({}))).toBe("");
  });
});

describe("a filter for every column", () => {
  it("turns column params into the service's filters", () => {
    const filters = productListParams(
      loadProductState({
        nazwa: " szyba ",
        sku: "5Q0",
        nastanie_od: "1",
        dostepne_do: "0",
        zmiana_od: "2026-11-01",
        zmiana_do: "2026-11-10",
      })
    ).filters;
    expect(filters.name).toBe("szyba");
    expect(filters.sku).toBe("5Q0");
    expect(filters.on_hand_min).toBe("1");
    expect(filters.available_max).toBe("0");
    expect(filters.reserved_min).toBeNull();
    expect(filters.updated_from).toBe("2026-11-01");
    expect(filters.updated_to).toBe("2026-11-10");
  });
  it("drops quantity ranges for the ungrouped list and bad days", () => {
    const filters = productListParams(
      loadProductState({ grouped: "false", nastanie_od: "5", zmiana_od: "jutro" })
    ).filters;
    expect(filters.on_hand_min).toBeUndefined();
    expect(filters.updated_from).toBeNull();
  });
});
