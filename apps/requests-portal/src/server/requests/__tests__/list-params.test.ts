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
    expect(toQuery(parseListParams({ size: "100" }))).toEqual({ size: "100" });
  });

  it("keeps only non-default values in the address", () => {
    const input = parseListParams({ scope: "branch", f: "closed", q: "ZL/51481", p: "2" });
    expect(toQuery(input)).toEqual({ scope: "branch", f: "closed", q: "ZL/51481", p: "2" });
    expect(toQuery(parseListParams({}))).toEqual({});
  });

  it("gives the same key whatever the parameter order", () => {
    expect(listKey({ f: "closed", scope: "branch" })).toBe(
      listKey({ scope: "branch", f: "closed" })
    );
  });
});
