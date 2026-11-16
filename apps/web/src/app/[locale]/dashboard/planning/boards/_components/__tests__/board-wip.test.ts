import { describe, expect, it } from "vitest";
import type { KanbanBoardCard } from "@/lib/types/kanban";
import { moveExceedsWip, wipCount } from "../board-wip";

function card(id: string, columnId: string, extra: Partial<KanbanBoardCard> = {}) {
  return {
    id,
    column_id: columnId,
    is_inbox: false,
    is_template: false,
    ...extra,
  } as KanbanBoardCard;
}

describe("wipCount", () => {
  it("counts the list's cards but not templates or inbox cards", () => {
    const cards = [
      card("a", "todo"),
      card("b", "todo"),
      card("t", "todo", { is_template: true }),
      card("i", "todo", { is_inbox: true }),
      card("c", "done"),
    ];
    expect(wipCount(cards, "todo")).toBe(2);
    expect(wipCount(cards, "done")).toBe(1);
    expect(wipCount(cards, "none")).toBe(0);
  });
});

describe("moveExceedsWip", () => {
  const cards = [card("a", "doing"), card("b", "doing"), card("c", "todo")];

  it("warns when a card from another list goes past the limit", () => {
    expect(moveExceedsWip(cards, cards[2], "doing", 2)).toBe(true);
    expect(moveExceedsWip(cards, cards[2], "doing", 3)).toBe(false);
  });

  it("does not warn without a limit, inside the same list, or for a template", () => {
    expect(moveExceedsWip(cards, cards[2], "doing", null)).toBe(false);
    expect(moveExceedsWip(cards, cards[0], "doing", 1)).toBe(false);
    expect(moveExceedsWip(cards, card("t", "todo", { is_template: true }), "doing", 2)).toBe(false);
  });

  it("counts a card coming from the inbox", () => {
    expect(moveExceedsWip(cards, card("i", "", { is_inbox: true }), "doing", 2)).toBe(true);
  });
});
