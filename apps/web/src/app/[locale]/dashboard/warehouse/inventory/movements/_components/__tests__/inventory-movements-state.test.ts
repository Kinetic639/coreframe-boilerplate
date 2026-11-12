import { describe, expect, it } from "vitest";
import {
  loadMovementState,
  migrateMovementSearchParams,
  movementHref,
  movementListParams,
} from "../inventory-movements-state";

describe("movements list address", () => {
  it("reads the defaults: newest first, 50 rows, page 1", () => {
    const state = loadMovementState({});
    expect(movementListParams(state)).toEqual({
      search: "",
      page: 1,
      pageSize: 50,
      sort: { field: "created_at", direction: "desc" },
      filters: {
        movement_type_code: null,
        status: null,
        unit_id: null,
        warehouse_id: null,
        posted_from: null,
        posted_to: null,
      },
    });
  });

  it("passes several values per filter and drops ones it cannot read", () => {
    const state = loadMovementState({
      rodzaj: "101,abc,303",
      status: "posted,draft,nonsense",
      ksiegowanie_od: "2026-11-01",
      ksiegowanie_do: "bad",
    });
    const { filters } = movementListParams(state);
    expect(filters.movement_type_code).toEqual(["101", "303"]);
    expect(filters.status).toEqual(["posted", "draft"]);
    expect(filters.posted_from).toBe("2026-11-01");
    expect(filters.posted_to).toBeNull();
  });

  it("keeps a route key with brackets and a plus as the open movement", () => {
    const state = loadMovementState({ selected: "MMJ+(115)-2-26-3112" });
    expect(state.selected).toBe("MMJ+(115)-2-26-3112");
    expect(movementHref("/ruchy", state, { selected: null })).toBe("/ruchy");
  });

  it("translates an old DataView link once", () => {
    const { params, changed } = migrateMovementSearchParams({
      search: "PZ",
      page: "2",
      pageSize: "20",
      sort: "posted_at.asc",
      filters: JSON.stringify({ status: "posted", movement_type_code: "101" }),
    });
    expect(changed).toBe(true);
    const state = loadMovementState(params);
    expect(state).toMatchObject({
      q: "PZ",
      strona: 2,
      wierszy: 20,
      sort: "posted_at",
      direction: "asc",
      status: ["posted"],
      rodzaj: ["101"],
    });
    expect(migrateMovementSearchParams({ q: "PZ" }).changed).toBe(false);
  });
});
