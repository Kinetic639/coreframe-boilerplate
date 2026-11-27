import { describe, expect, it } from "vitest";
import { listKey, parseListParams, toQuery } from "../list-params";

describe("list params", () => {
  it("falls back to the defaults for missing or unknown values", () => {
    expect(parseListParams({ f: "nope", p: "-3", type: "x", sort: "?" })).toEqual({
      scope: "mine",
      filter: "open",
      typeId: null,
      search: null,
      sort: "activity",
      page: 1,
      size: 50,
    });
  });

  it("accepts only the offered page sizes", () => {
    expect(parseListParams({ size: "20" }).size).toBe(20);
    expect(parseListParams({ size: "37" }).size).toBe(50);
    expect(toQuery(parseListParams({ wierszy: "100" }))).toEqual({ wierszy: "100" });
  });

  it("keeps only non-default values in the address", () => {
    const input = parseListParams({ scope: "branch", f: "closed", q: "ZL/51481", strona: "2" });
    expect(toQuery(input)).toEqual({ scope: "branch", f: "closed", q: "ZL/51481", strona: "2" });
    expect(toQuery(parseListParams({}))).toEqual({});
  });

  it("still reads the old page, size and type keys", () => {
    const type = "0b6c1d2e-3f40-4a5b-8c6d-7e8f90a1b2c3";
    const input = parseListParams({ p: "3", size: "20", type });
    expect(input).toMatchObject({ page: 3, size: 20, typeId: type });
    expect(toQuery(input)).toEqual({ strona: "3", wierszy: "20", typ: type });
  });

  it("gives the same key whatever the parameter order", () => {
    expect(listKey({ f: "closed", scope: "branch" })).toBe(
      listKey({ scope: "branch", f: "closed" })
    );
  });
});
