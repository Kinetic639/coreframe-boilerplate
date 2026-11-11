import { beforeEach, describe, expect, it } from "vitest";
import { readUsage, recordUsage, usageScore } from "../frecency";
import { buildPaletteGroups, type PaletteItem } from "../palette";

const DAY = 24 * 60 * 60 * 1000;

describe("frecency", () => {
  beforeEach(() => window.localStorage.clear());

  it("counts openings per user and organization", () => {
    recordUsage("u1", "o1", "a");
    recordUsage("u1", "o1", "a");
    expect(readUsage("u1", "o1").a?.c).toBe(2);
    expect(readUsage("u1", "o2")).toEqual({});
  });

  it("weighs recent use higher than old use", () => {
    const now = Date.now();
    const map = { fresh: { c: 2, t: now }, old: { c: 2, t: now - 40 * DAY } };
    expect(usageScore(map, "fresh", now)).toBeGreaterThan(usageScore(map, "old", now));
    expect(usageScore(map, "never", now)).toBe(0);
  });

  it("ignores malformed storage", () => {
    window.localStorage.setItem(
      "ambra.globalSearch.usage.u1.o1",
      '{"a":{"c":"x"},"b":{"c":1,"t":1}}'
    );
    expect(Object.keys(readUsage("u1", "o1"))).toEqual(["b"]);
  });
});

describe("palette ranking with usage", () => {
  const items: PaletteItem[] = [
    { id: "p1", kind: "page", section: "warehouse", label: "Stany magazynowe" },
    { id: "p2", kind: "page", section: "warehouse", label: "Stany minimalne" },
    { id: "a1", kind: "action", section: "workshop", label: "Nowe zlecenie" },
    { id: "a2", kind: "action", section: "warehouse", label: "Nowy ruch" },
  ];
  const usage = (id: string) => (id === "p2" || id === "a2" ? 5 : 0);

  it("moves the most used match first without adding non-matches", () => {
    const [pages] = buildPaletteGroups("stany", items, undefined, usage);
    expect(pages!.items.map((i) => i.id)).toEqual(["p2", "p1"]);
    expect(buildPaletteGroups("zzz", items, undefined, usage)).toEqual([]);
  });

  it("orders the empty state by usage", () => {
    const groups = buildPaletteGroups("", items, undefined, usage);
    expect(groups[0]!.items.map((i) => i.id)).toEqual(["a2", "a1"]);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(["p2", "p1"]);
  });
});
