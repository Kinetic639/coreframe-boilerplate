import { beforeEach, describe, expect, it } from "vitest";
import { highlightRanges } from "../match";
import { buildPaletteGroups, parsePaletteQuery, withPalettePrefix } from "../palette";
import {
  pushRecentSearch,
  readRecentSearches,
  RECENT_LIMIT,
  type RecentSearchItem,
} from "../recent";
import { resolveSearchSources } from "../sources";
import {
  MEMBERS_READ,
  MODULE_ORGANIZATION_MANAGEMENT_ACCESS,
  MODULE_WORKSHOP_ACCESS,
  WORKSHOP_REPAIR_ORDERS_READ,
} from "@/lib/constants/permissions";
import { MODULE_ORGANIZATION_MANAGEMENT, MODULE_WORKSHOP } from "@/lib/constants/modules";

describe("scope prefixes", () => {
  it("recognizes scope prefixes case-insensitively", () => {
    expect(parsePaletteQuery("ZL: 1742")).toMatchObject({
      scope: "repairOrders",
      prefix: "zl:",
      text: "1742",
    });
    expect(parsePaletteQuery("@kowal")).toMatchObject({ scope: "people", text: "kowal" });
    expect(parsePaletteQuery("cz:2K5")).toMatchObject({ scope: "items", text: "2K5" });
  });

  it("ignores prefixes of sources the user may not search", () => {
    expect(parsePaletteQuery("zl: 1742", ["items"])).toEqual({
      actionsMode: false,
      text: "zl: 1742",
    });
  });

  it("hides pages and actions in a scope", () => {
    const items = [
      { id: "p", kind: "page" as const, section: "workshop" as const, label: "Zlecenia" },
    ];
    expect(buildPaletteGroups("zl: zle", items)).toEqual([]);
    expect(buildPaletteGroups("zle", items)).toHaveLength(1);
  });

  it("switches the prefix and keeps the typed text", () => {
    expect(withPalettePrefix("2K5807", "cz:")).toBe("cz: 2K5807");
    expect(withPalettePrefix("cz: 2K5807", "zl:")).toBe("zl: 2K5807");
    expect(withPalettePrefix("> nowe", null)).toBe("nowe");
    expect(withPalettePrefix("", "@")).toBe("@ ");
  });
});

describe("resolveSearchSources", () => {
  it("needs both the module and the permissions", () => {
    const snapshot = {
      allow: [MODULE_WORKSHOP_ACCESS, WORKSHOP_REPAIR_ORDERS_READ, MEMBERS_READ],
      deny: [],
    };
    expect(resolveSearchSources(snapshot, [MODULE_WORKSHOP])).toEqual(["repairOrders"]);
    expect(
      resolveSearchSources(
        { ...snapshot, allow: [...snapshot.allow, MODULE_ORGANIZATION_MANAGEMENT_ACCESS] },
        [MODULE_WORKSHOP, MODULE_ORGANIZATION_MANAGEMENT]
      )
    ).toEqual(["repairOrders", "people"]);
  });
});

describe("highlightRanges", () => {
  it("highlights every query word, ignoring diacritics", () => {
    expect(highlightRanges("Przyjęcie dostawy", "przyjecie")).toEqual([[0, 9]]);
    expect(highlightRanges("Nowe zlecenie", "now zle")).toEqual([
      [0, 3],
      [5, 8],
    ]);
    expect(highlightRanges("Łódź", "lodz")).toEqual([[0, 4]]);
  });

  it("returns nothing for no match or an empty query", () => {
    expect(highlightRanges("Stany", "xyz")).toEqual([]);
    expect(highlightRanges("Stany", "")).toEqual([]);
  });
});

describe("recent searches", () => {
  const item = (id: string): RecentSearchItem => ({
    id,
    kind: "page",
    label: id,
    icon: "car",
    href: `/dashboard/${id}`,
  });

  beforeEach(() => window.localStorage.clear());

  it("keeps the newest first, without duplicates, up to the limit", () => {
    for (let i = 0; i < RECENT_LIMIT + 2; i += 1) pushRecentSearch("u1", "o1", item(`p${i}`));
    pushRecentSearch("u1", "o1", item("p3"));
    const list = readRecentSearches("u1", "o1");
    expect(list).toHaveLength(RECENT_LIMIT);
    expect(list[0]!.id).toBe("p3");
    expect(list.filter((r) => r.id === "p3")).toHaveLength(1);
  });

  it("is kept per user and organization", () => {
    pushRecentSearch("u1", "o1", item("a"));
    expect(readRecentSearches("u1", "o2")).toEqual([]);
    expect(readRecentSearches("u2", "o1")).toEqual([]);
  });

  it("drops stored rows that are not dashboard links", () => {
    window.localStorage.setItem(
      "ambra.globalSearch.recent.u1.o1",
      JSON.stringify([{ ...item("x"), href: "https://evil.example" }, item("ok"), "junk"])
    );
    expect(readRecentSearches("u1", "o1").map((r) => r.id)).toEqual(["ok"]);
  });
});
