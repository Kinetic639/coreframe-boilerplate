import { describe, expect, it } from "vitest";
import { viewQueryOf } from "../saved-views";

describe("viewQueryOf", () => {
  it("keeps the search, filters and sort, never the page or the open record", () => {
    const query = viewQueryOf(
      "?q=szyba&status=active&sort=name&strona=3&selected=abc&tab=stock&panel=1",
      ["panel"]
    );
    const params = new URLSearchParams(query);
    expect(params.get("q")).toBe("szyba");
    expect(params.get("status")).toBe("active");
    expect(params.get("sort")).toBe("name");
    for (const key of ["strona", "selected", "tab", "panel"]) expect(params.has(key)).toBe(false);
  });

  it("reads the same view the same way whatever the order and encoding", () => {
    expect(viewQueryOf("?status=active,archived&product_type=consumable")).toBe(
      viewQueryOf("?product_type=consumable&status=active%2Carchived")
    );
  });

  it("is empty for a list with nothing set", () => {
    expect(viewQueryOf("")).toBe("");
    expect(viewQueryOf("?strona=2&q=")).toBe("");
  });
});
