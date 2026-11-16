import { describe, expect, it } from "vitest";
import type { KanbanBoardCard } from "@/lib/types/kanban";
import {
  NO_FILTERS,
  activeFilterCount,
  cardMatches,
  filterCards,
  fullIndexFromVisible,
  hasActiveFilters,
  type BoardFilters,
} from "../board-filters";

const ME_ID = "user-me";
const NOW = new Date(2026, 10, 16, 10, 0, 0);

function card(id: string, extra: Partial<KanbanBoardCard> = {}): KanbanBoardCard {
  return {
    id,
    title: `Card ${id}`,
    task_number: `TSK-${id}`,
    description: null,
    assigned_to: null,
    assignee_name: null,
    priority: "normal",
    status: "open",
    due_at: null,
    due_has_time: false,
    label: null,
    labels: [],
    ...extra,
  } as KanbanBoardCard;
}

const filters = (extra: Partial<BoardFilters>): BoardFilters => ({ ...NO_FILTERS, ...extra });
const label = (id: string, name: string) => ({ id, name, color: "#000000", position: 0 });

describe("board filters", () => {
  it("knows when nothing filters", () => {
    expect(hasActiveFilters(NO_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ q: "  " }))).toBe(false);
    expect(hasActiveFilters(filters({ q: "x" }))).toBe(true);
    expect(activeFilterCount(filters({ q: "x", people: ["me"], due: "none" }))).toBe(2);
  });

  it("searches title, number, labels and assignee, ignoring case and accents", () => {
    const c = card("1", {
      title: "Wymiana łożysk",
      assignee_name: "Anna Nowak",
      labels: [label("l1", "Pilne")],
    });
    expect(cardMatches(c, filters({ q: "WYMIANA" }), ME_ID, NOW)).toBe(true);
    expect(cardMatches(c, filters({ q: "lozysk" }), ME_ID, NOW)).toBe(true);
    expect(cardMatches(c, filters({ q: "pilne anna" }), ME_ID, NOW)).toBe(true);
    expect(cardMatches(c, filters({ q: "tsk-1" }), ME_ID, NOW)).toBe(true);
    expect(cardMatches(c, filters({ q: "silnik" }), ME_ID, NOW)).toBe(false);
  });

  it("filters people: me, nobody or anyone picked (any of them)", () => {
    const mine = card("1", { assigned_to: ME_ID });
    const nobody = card("2");
    const other = card("3", { assigned_to: "user-2" });
    expect(filterCards([mine, nobody, other], filters({ people: ["me"] }), ME_ID, NOW)).toEqual([
      mine,
    ]);
    expect(
      filterCards([mine, nobody, other], filters({ people: ["none", "user-2"] }), ME_ID, NOW)
    ).toEqual([nobody, other]);
  });

  it("filters labels (any picked) and priority", () => {
    const a = card("1", { labels: [label("l1", "A")], priority: "high" });
    const b = card("2", { labels: [label("l2", "B")] });
    expect(filterCards([a, b], filters({ labels: ["l2", "l3"] }), ME_ID, NOW)).toEqual([b]);
    expect(filterCards([a, b], filters({ priority: ["high", "urgent"] }), ME_ID, NOW)).toEqual([a]);
    expect(filterCards([a, b], filters({ labels: ["l1"], priority: ["low"] }), ME_ID, NOW)).toEqual(
      []
    );
  });

  it("filters due dates; done tasks are never overdue", () => {
    const at = (d: number, h = 12) => new Date(2026, 10, d, h, 0, 0).toISOString();
    const overdue = card("1", { due_at: at(15) });
    const doneLate = card("2", { due_at: at(15), status: "completed" });
    const today = card("3", { due_at: at(16) });
    const lateToday = card("4", { due_at: at(16, 8), due_has_time: true });
    const nextWeek = card("5", { due_at: at(21) });
    const none = card("6");
    const all = [overdue, doneLate, today, lateToday, nextWeek, none];
    expect(filterCards(all, filters({ due: "overdue" }), ME_ID, NOW)).toEqual([overdue, lateToday]);
    expect(filterCards(all, filters({ due: "soon" }), ME_ID, NOW)).toEqual([today, lateToday]);
    expect(filterCards(all, filters({ due: "week" }), ME_ID, NOW)).toEqual([
      today,
      lateToday,
      nextWeek,
    ]);
    expect(filterCards(all, filters({ due: "none" }), ME_ID, NOW)).toEqual([none]);
  });
});

describe("fullIndexFromVisible", () => {
  const full = ["a", "b", "c", "d", "e"];
  it("drops above a shown card", () => {
    expect(fullIndexFromVisible(full, ["b", "d"], 0)).toBe(1);
    expect(fullIndexFromVisible(full, ["b", "d"], 1)).toBe(3);
  });
  it("drops after the last shown card", () => {
    expect(fullIndexFromVisible(full, ["b", "d"], 2)).toBe(4);
  });
  it("goes to the end when nothing is shown", () => {
    expect(fullIndexFromVisible(full, [], 0)).toBe(5);
  });
});
