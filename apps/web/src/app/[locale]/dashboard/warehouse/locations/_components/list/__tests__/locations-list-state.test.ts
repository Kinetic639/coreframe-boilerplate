import { describe, expect, it } from "vitest";
import type { WarehouseLocation } from "@/lib/warehouse/location-tree";
import {
  listLocations,
  locationHref,
  locationRows,
  migrateLocationSearch,
  type LocationState,
} from "../locations-list-state";

const location = (
  id: string,
  parent: string | null,
  patch: Partial<WarehouseLocation> = {}
): WarehouseLocation =>
  ({
    id,
    parent_id: parent,
    name: `Name ${id}`,
    code: id.toUpperCase(),
    level: 0,
    sort_order: 0,
    storage_mode: "standard",
    can_store_inventory: false,
    color: null,
    created_at: "2026-01-01T00:00:00Z",
    ...patch,
  }) as WarehouseLocation;

const state = (patch: Partial<LocationState> = {}): LocationState => ({
  q: "",
  strona: 1,
  wierszy: 50,
  sort: "struktura",
  direction: "asc",
  selected: null,
  magazynowa: [],
  tryb: [],
  poziom: [],
  ...patch,
});

const tree = [
  location("b", null, { sort_order: 2 }),
  location("a", null, { sort_order: 1 }),
  location("a2", "a", { level: 1, sort_order: 2, can_store_inventory: true, storage_mode: "bin" }),
  location("a1", "a", { level: 1, sort_order: 1, created_at: "2026-03-01T00:00:00Z" }),
];

describe("locationRows", () => {
  it("lists parents before their children, in sort order, with code paths", () => {
    const rows = locationRows(tree);
    expect(rows.map((row) => row.id)).toEqual(["a", "a1", "a2", "b"]);
    expect(rows.find((row) => row.id === "a2")?.path).toBe("A / A2");
  });

  it("keeps a location whose parent is missing, as a root", () => {
    const rows = locationRows([location("x", "gone")]);
    expect(rows.map((row) => row.path)).toEqual(["X"]);
  });

  it("does not loop on a parent cycle", () => {
    const rows = locationRows([location("p", "q"), location("q", "p")]);
    expect(rows).toEqual([]);
  });
});

describe("listLocations", () => {
  const rows = locationRows(tree);

  it("searches code, name and path", () => {
    expect(listLocations(rows, state({ q: "a2" })).rows.map((r) => r.id)).toEqual(["a2"]);
    expect(listLocations(rows, state({ q: "name b" })).rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("filters by stock flag, storage mode and level", () => {
    expect(listLocations(rows, state({ magazynowa: ["tak"] })).rows.map((r) => r.id)).toEqual([
      "a2",
    ]);
    expect(listLocations(rows, state({ tryb: ["bin"] })).totalCount).toBe(1);
    expect(listLocations(rows, state({ poziom: [1] })).rows.map((r) => r.id)).toEqual(["a1", "a2"]);
  });

  it("sorts by a field, both ways", () => {
    expect(
      listLocations(rows, state({ sort: "code", direction: "desc" })).rows.map((r) => r.id)
    ).toEqual(["b", "a2", "a1", "a"]);
    expect(listLocations(rows, state({ sort: "created_at" })).rows.at(-1)?.id).toBe("a1");
  });

  it("pages, and keeps a page past the end on the last one", () => {
    const result = listLocations(rows, state({ wierszy: 20, strona: 9 }));
    expect(result.page).toBe(1);
    expect(result.rows).toHaveLength(4);
  });
});

describe("locationHref", () => {
  it("keeps the list view on the address and drops defaults", () => {
    expect(locationHref("/pl/x", state(), { strona: 2 })).toBe("/pl/x?strona=2&view=list");
  });
});

describe("migrateLocationSearch", () => {
  it("translates old DataView params", () => {
    const migrated = migrateLocationSearch(
      `view=list&search=reg&page=2&sort=name.desc&filters=${encodeURIComponent(
        JSON.stringify({ can_store_inventory: "true", storage_mode: "bin", level: "1" })
      )}`
    );
    const params = new URLSearchParams(migrated!);
    expect(Object.fromEntries(params)).toEqual({
      view: "list",
      q: "reg",
      strona: "2",
      sort: "name",
      direction: "desc",
      magazynowa: "tak",
      tryb: "bin",
      poziom: "1",
    });
  });

  it("leaves a current address alone", () => {
    expect(migrateLocationSearch("view=list&q=a&strona=2")).toBeNull();
  });
});
